# Reconciles bank statements against internal ledger using LLM-assisted matching
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a financial reconciliation agent. Match bank transactions to ledger entries."),
    ("user", "Bank: {bank_entry}\nLedger: {ledger_entry}\n\nAre these the same transaction? Return JSON: {{\"match\": bool, \"confidence\": float, \"reason\": str}}"),
])

chain = prompt | llm


def reconcile(bank_entry: dict, ledger_entry: dict) -> dict:
    result = chain.invoke({
        "bank_entry": str(bank_entry),
        "ledger_entry": str(ledger_entry),
    })
    return {"bank_id": bank_entry["id"], "ledger_id": ledger_entry["id"], "result": result.content}
