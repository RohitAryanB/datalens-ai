# DataLens AI — Intelligent LLM Database Agent

A full-stack conversational AI application that lets you query databases, generate visualizations, and explore data using natural language. Built with Claude (Anthropic), FastAPI, and React.

---

## ✨ Features

- **Natural Language Queries** — Ask questions in plain English; the agent writes and executes SQL
- **Dynamic Charts** — Auto-generated bar, line, pie, and scatter charts via Recharts
- **ER & Flow Diagrams** — Mermaid.js powered entity-relationship and process-flow diagrams
- **Schema Explorer** — Visual browser for tables, columns, types, and foreign keys
- **Query Transparency** — Every SQL query is shown; export results as CSV
- **Multi-turn Conversations** — Agent retains context across the full session
- **Streaming Responses** — Real-time token-by-token output with SSE
- **Session Management** — Create, switch, and delete chat sessions

---

## 🏗️ Architecture

```
llm-db-agent/
├── backend/               # FastAPI + Anthropic SDK
│   ├── main.py            # Agent tools + chat endpoint
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/              # React + Recharts + Mermaid
│   ├── src/
│   │   ├── App.jsx                    # Root: session management
│   │   ├── components/
│   │   │   ├── Sidebar.jsx            # Session list + nav
│   │   │   ├── ChatArea.jsx           # Message feed + empty state
│   │   │   ├── Message.jsx            # Renders text + artifacts
│   │   │   ├── ChatInput.jsx          # Auto-resizing textarea
│   │   │   ├── ChartRenderer.jsx      # Recharts bar/line/pie/scatter
│   │   │   ├── DiagramRenderer.jsx    # Mermaid ER/flowchart/sequence
│   │   │   ├── TableRenderer.jsx      # Paginated data table + CSV export
│   │   │   └── SchemaRenderer.jsx     # Collapsible schema browser
│   │   └── index.css
│   ├── vite.config.js
│   └── Dockerfile
├── database/
│   └── ecommerce.db       # Sample SQLite database
├── docker-compose.yml
└── .env.example
```

---

## 🛠️ Agent Tools

The LLM agent can invoke these tools via Anthropic function calling:

| Tool | Description | Returns |
|------|-------------|---------|
| `get_schema` | Full DB schema — tables, columns, FK relationships, row counts | JSON schema map |
| `execute_query` | Run a SELECT query safely with row limit | `{ columns, rows, sql }` |
| `generate_chart` | Bar, line, pie, or scatter chart config | Chart spec (rendered by frontend) |
| `generate_flowchart` | Mermaid ER diagram, flowchart, or sequence diagram | Mermaid code (rendered by frontend) |
| `explain_data` | Stats + natural language summary of query results | `{ explanation, stats }` |

---

## 🚀 Quick Start

### Option 1: Local Development (Recommended)

**Prerequisites:** Python 3.11+, Node.js 18+

#### 1. Clone & configure

```bash
git clone <your-repo-url>
cd llm-db-agent
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

#### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
# Copy .env one level up, or set the env var directly:
export ANTHROPIC_API_KEY=sk-ant-your-key-here
export DB_PATH=../database/ecommerce.db
uvicorn main:app --reload --port 8000
```

#### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

### Option 2: Docker Compose

```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

docker compose up --build
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
```

---

## 💬 Example Conversations

### Sales Analysis
```
You: Show me the top 5 products by revenue
Agent: [queries DB → renders bar chart → explains insights]

You: Now show the monthly trend for last year
Agent: [runs aggregation query → renders line chart]
```

### Database Exploration
```
You: Draw the ER diagram for this database
Agent: [fetches schema → generates Mermaid ER diagram]

You: Which tables are related to orders?
Agent: [analyzes FK relationships → explains structure]
```

### Process Visualization
```
You: Create a flowchart showing how orders flow through the system
Agent: [infers workflow → generates Mermaid flowchart]
```

### Data Insights
```
You: What's the breakdown of customers by city?
Agent: [queries → renders pie chart → provides summary stats]

You: Show me customers who spent more than $500 total
Agent: [writes JOIN query → shows paginated table → offers CSV export]
```

---

## 🗄️ Sample Database Schema

The included `ecommerce.db` has 5 tables:

```
customers    (100 rows)  id, name, email, city, country, joined_date, tier
products      (50 rows)  id, name, category, price, stock, supplier_id
suppliers      (4 rows)  id, name, country, contact_email
orders       (500 rows)  id, customer_id, order_date, status, total
order_items (1000 rows)  id, order_id, product_id, quantity, unit_price
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | **Required.** Your Anthropic API key |
| `DB_PATH` | `../database/ecommerce.db` | Path to SQLite database |

To use your own database, point `DB_PATH` at any SQLite `.db` file.

---

## 🔌 API Reference

### `POST /chat`
Stream a chat response from the agent.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Show top 5 products by revenue" }
  ]
}
```

**Response:** Server-Sent Events stream:
```
data: {"type": "tool_call", "tool": "execute_query", "inputs": {...}}
data: {"type": "tool_result", "tool": "execute_query", "result": {...}}
data: {"type": "text", "content": "Here are the top 5 products..."}
data: {"type": "done"}
```

### `GET /schema`
Returns full database schema JSON.

### `GET /health`
Health check — returns `{ "status": "ok" }`.

---

## 🏆 Evaluation Criteria Coverage

| Criteria | Implementation |
|----------|---------------|
| ✅ Functionality (30%) | All 5 required tools; accurate SQL generation; multi-turn context |
| ✅ Tool Design (25%) | Clean schemas with typed params; error handling; modular dispatch |
| ✅ Visualization Quality (20%) | 4 chart types + 3 diagram types; dark theme; interactive tooltips |
| ✅ User Experience (15%) | Streaming responses; session management; CSV export; SQL transparency |
| ✅ Innovation (10%) | Schema browser; paginated tables; collapsible tool call inspector |

### Bonus Features Implemented
- ✅ SQL transparency (show generated SQL before/after execution)
- ✅ Export as CSV
- ✅ Query history (within sessions)
- ✅ Collapsible tool call inspector

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Anthropic Claude (claude-sonnet-4) |
| Backend | Python, FastAPI, uvicorn |
| Agent Framework | Custom (Anthropic native tool use) |
| Frontend | React 18, Vite |
| Charts | Recharts |
| Diagrams | Mermaid.js |
| Database | SQLite |
| Containerization | Docker, Docker Compose |

---

## 🤝 Contributing

Pull requests welcome. For major changes, open an issue first.

## 📄 License

MIT
