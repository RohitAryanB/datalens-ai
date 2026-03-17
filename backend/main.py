"""
LLM Database Agent - FastAPI Backend
Using Groq API (free tier) with tool calling
Includes rate limit handling with countdown timer
"""

import json
import sqlite3
import os
import re
import asyncio
import time
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import Groq, RateLimitError

app = FastAPI(title="LLM DB Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("DB_PATH", "../database/ecommerce.db")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─────────────────────────────────────────────
# Rate Limit State (in-memory)
# ─────────────────────────────────────────────

rate_limit_state = {
    "is_limited": False,
    "retry_after_ts": 0.0,   # Unix timestamp when limit lifts
    "message": ""
}


def parse_wait_seconds(error_message: str) -> float:
    """
    Extract wait duration in seconds from Groq rate limit error message.
    Handles formats like '2m0.96s', '45s', '1m30s', '90.5s'.
    Returns 60.0 as fallback.
    """
    # Try to find pattern like "2m0.96s" or "1m30s"
    match = re.search(r'try again in\s+((?:(\d+)m)?([\d.]+)s)', error_message, re.IGNORECASE)
    if match:
        minutes = int(match.group(2)) if match.group(2) else 0
        seconds = float(match.group(3)) if match.group(3) else 0.0
        return minutes * 60 + seconds

    # Try plain seconds like "45.5s"
    match = re.search(r'try again in\s+([\d.]+)s', error_message, re.IGNORECASE)
    if match:
        return float(match.group(1))

    return 60.0  # fallback


# ─────────────────────────────────────────────
# Agent Tool Implementations
# ─────────────────────────────────────────────

def get_schema() -> dict:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in c.fetchall()]
    schema = {}
    for table in tables:
        c.execute(f"PRAGMA table_info({table})")
        cols = [{"name": r[1], "type": r[2], "notnull": bool(r[3]), "pk": bool(r[5])} for r in c.fetchall()]
        c.execute(f"PRAGMA foreign_key_list({table})")
        fks = [{"from": r[3], "to_table": r[2], "to_col": r[4]} for r in c.fetchall()]
        c.execute(f"SELECT COUNT(*) FROM {table}")
        row_count = c.fetchone()[0]
        schema[table] = {"columns": cols, "foreign_keys": fks, "row_count": row_count}
    conn.close()
    return {"schema": schema, "table_count": len(tables), "tables": tables}


def execute_query(sql: str, limit: int = 100) -> dict:
    sql = sql.strip()
    if not re.match(r'^\s*SELECT', sql, re.IGNORECASE):
        return {"error": "Only SELECT queries are permitted.", "sql": sql}
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip(";") + f" LIMIT {limit}"
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(sql)
        rows = [dict(r) for r in c.fetchall()]
        columns = [desc[0] for desc in c.description] if c.description else []
        conn.close()
        return {"columns": columns, "rows": rows, "row_count": len(rows), "sql": sql, "success": True}
    except Exception as e:
        return {"error": str(e), "sql": sql, "success": False}


def generate_chart(chart_type: str, data: list, x_key: str, y_key: str,
                   title: str = "", color: str = "#6366f1") -> dict:
    valid_types = ["bar", "line", "pie", "scatter"]
    if chart_type not in valid_types:
        return {"error": f"Invalid chart type. Choose from: {valid_types}"}
    return {
        "type": "chart",
        "chart_type": chart_type,
        "data": data,
        "x_key": x_key,
        "y_key": y_key,
        "title": title or f"{chart_type.capitalize()} Chart",
        "color": color,
    }


def generate_flowchart(diagram_type: str, content: str, title: str = "") -> dict:
    valid = ["er", "flowchart", "sequence"]
    if diagram_type not in valid:
        return {"error": f"Invalid diagram type. Choose from: {valid}"}
    return {
        "type": "diagram",
        "diagram_type": diagram_type,
        "mermaid": content,
        "title": title or f"{diagram_type.upper()} Diagram",
    }


def explain_data(data: list, context: str = "") -> dict:
    if not data:
        return {"explanation": "No data returned.", "stats": {}}
    stats = {}
    for key in data[0]:
        vals = [r[key] for r in data if isinstance(r.get(key), (int, float))]
        if vals:
            stats[key] = {
                "min": min(vals), "max": max(vals),
                "avg": round(sum(vals) / len(vals), 2),
                "sum": round(sum(vals), 2)
            }
    return {
        "explanation": f"Query returned {len(data)} records. {context}",
        "stats": stats,
        "sample": data[:3]
    }


# ─────────────────────────────────────────────
# Tool Definitions (OpenAI-compatible format for Groq)
# ─────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_schema",
            "description": "Retrieve the full database schema including all tables, columns, data types, primary keys, foreign keys, and row counts. Call this first to understand the database structure.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_query",
            "description": "Execute a SQL SELECT query against the SQLite database and return results as JSON. Only SELECT queries allowed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "Valid SQLite SELECT query to execute"},
                    "limit": {"type": "integer", "description": "Maximum rows to return, default 100"}
                },
                "required": ["sql"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_chart",
            "description": "Generate a data visualization chart. Types: bar, line, pie, scatter. Call after execute_query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_type": {"type": "string", "enum": ["bar", "line", "pie", "scatter"]},
                    "data": {"type": "array", "description": "Array of data objects from execute_query"},
                    "x_key": {"type": "string", "description": "Column name for X axis"},
                    "y_key": {"type": "string", "description": "Column name for Y axis (must be numeric)"},
                    "title": {"type": "string", "description": "Chart title"},
                    "color": {"type": "string", "description": "Hex color e.g. #6366f1"}
                },
                "required": ["chart_type", "data", "x_key", "y_key"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_flowchart",
            "description": "Generate ER diagrams, flowcharts, or sequence diagrams using Mermaid syntax.",
            "parameters": {
                "type": "object",
                "properties": {
                    "diagram_type": {"type": "string", "enum": ["er", "flowchart", "sequence"]},
                    "content": {"type": "string", "description": "Valid Mermaid diagram code"},
                    "title": {"type": "string", "description": "Diagram title"}
                },
                "required": ["diagram_type", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "explain_data",
            "description": "Generate statistical summary and natural language explanation of query results.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {"type": "array", "description": "Array of data objects to analyze"},
                    "context": {"type": "string", "description": "Additional context"}
                },
                "required": ["data"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are DataLens AI, an intelligent database analyst assistant. You help users explore, query, and visualize data from a SQLite ecommerce database.

Database contains: customers, products, orders, order_items, suppliers tables.

Your capabilities:
- Query the database using natural language
- Generate beautiful charts (bar, line, pie, scatter)
- Create ER diagrams and flowcharts
- Provide data insights and explanations

Guidelines:
1. Always call get_schema first if you are unsure about table structure
2. Write efficient, safe SQL queries (SELECT only)
3. After querying data, visualize it with an appropriate chart
4. Provide clear, concise insights about the data
5. For visualizations: pass the actual rows array to generate_chart
6. Format numbers clearly (currency with $, percentages with %)
7. Be conversational and helpful

When generating ER diagrams, use proper Mermaid erDiagram syntax.
When generating flowcharts, use graph TD syntax with descriptive node labels."""


# ─────────────────────────────────────────────
# API Models
# ─────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    stream: bool = True


# ─────────────────────────────────────────────
# Tool Dispatcher
# ─────────────────────────────────────────────

def dispatch_tool(name: str, inputs: dict) -> Any:
    if name == "get_schema":
        return get_schema()
    elif name == "execute_query":
        return execute_query(inputs.get("sql", ""), inputs.get("limit", 100))
    elif name == "generate_chart":
        return generate_chart(
            inputs.get("chart_type", "bar"),
            inputs.get("data", []),
            inputs.get("x_key", ""),
            inputs.get("y_key", ""),
            inputs.get("title", ""),
            inputs.get("color", "#6366f1")
        )
    elif name == "generate_flowchart":
        return generate_flowchart(
            inputs.get("diagram_type", "flowchart"),
            inputs.get("content", ""),
            inputs.get("title", "")
        )
    elif name == "explain_data":
        return explain_data(inputs.get("data", []), inputs.get("context", ""))
    return {"error": f"Unknown tool: {name}"}


# ─────────────────────────────────────────────
# Rate Limit Status Endpoint
# ─────────────────────────────────────────────

@app.get("/rate-limit-status")
async def rate_limit_status():
    """
    Returns current rate limit state.
    Frontend polls this to show a live countdown timer.
    """
    now = time.time()
    if rate_limit_state["is_limited"]:
        remaining = rate_limit_state["retry_after_ts"] - now
        if remaining <= 0:
            # Limit has lifted
            rate_limit_state["is_limited"] = False
            rate_limit_state["retry_after_ts"] = 0.0
            rate_limit_state["message"] = ""
            return {"is_limited": False, "remaining_seconds": 0, "message": ""}
        return {
            "is_limited": True,
            "remaining_seconds": round(remaining, 1),
            "retry_after_ts": rate_limit_state["retry_after_ts"],
            "message": rate_limit_state["message"]
        }
    return {"is_limited": False, "remaining_seconds": 0, "message": ""}


# ─────────────────────────────────────────────
# Chat Endpoint
# ─────────────────────────────────────────────

@app.post("/chat")
async def chat(request: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    # Block request immediately if still rate limited
    now = time.time()
    if rate_limit_state["is_limited"] and rate_limit_state["retry_after_ts"] > now:
        remaining = round(rate_limit_state["retry_after_ts"] - now, 1)
        mins = int(remaining // 60)
        secs = int(remaining % 60)
        time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
        raise HTTPException(
            status_code=429,
            detail={
                "type": "rate_limited",
                "message": f"Rate limit active. Please wait {time_str} before trying again.",
                "remaining_seconds": remaining,
                "retry_after_ts": rate_limit_state["retry_after_ts"]
            }
        )

    client = Groq(api_key=GROQ_API_KEY)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in request.messages]

    async def run_agent():
        current_messages = messages.copy()
        loop = asyncio.get_event_loop()

        while True:
            # ── Groq API call with rate limit handling ──
            try:
                response = await loop.run_in_executor(
                    None,
                    lambda msgs=current_messages: client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        max_tokens=4096,
                        tools=TOOLS,
                        tool_choice="auto",
                        messages=msgs,
                    )
                )
            except RateLimitError as e:
                error_str = str(e)
                wait_seconds = parse_wait_seconds(error_str)

                # Store state so /rate-limit-status can serve countdown
                rate_limit_state["is_limited"] = True
                rate_limit_state["retry_after_ts"] = time.time() + wait_seconds
                rate_limit_state["message"] = error_str

                mins = int(wait_seconds // 60)
                secs = int(wait_seconds % 60)
                time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

                yield f"data: {json.dumps({'type': 'rate_limit', 'wait_seconds': wait_seconds, 'retry_after_ts': rate_limit_state['retry_after_ts'], 'message': f'⚠️ Groq rate limit reached. You can prompt again in {time_str}. The countdown is shown below.'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Unexpected error: {str(e)}'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            msg = response.choices[0].message
            tool_calls = msg.tool_calls or []
            text_content = msg.content or ""

            if text_content:
                yield f"data: {json.dumps({'type': 'text', 'content': text_content})}\n\n"

            if tool_calls:
                # Add assistant message with tool calls to history
                current_messages.append({
                    "role": "assistant",
                    "content": text_content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                        }
                        for tc in tool_calls
                    ]
                })

                for tc in tool_calls:
                    name = tc.function.name
                    try:
                        inputs = json.loads(tc.function.arguments)
                    except Exception:
                        inputs = {}

                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': name, 'inputs': inputs})}\n\n"
                    result = dispatch_tool(name, inputs)
                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': name, 'result': result})}\n\n"

                    current_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result)
                    })

                # Continue the loop so the model can respond after tools
                continue
            else:
                break

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(run_agent(), media_type="text/event-stream")


@app.get("/schema")
async def schema():
    return get_schema()


@app.get("/health")
async def health():
    return {"status": "ok", "db": DB_PATH}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)