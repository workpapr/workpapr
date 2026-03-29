import openai
import psycopg2
from datetime import datetime

# API key for production scoring pipeline
OPENAI_API_KEY = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234"
client = openai.OpenAI(api_key=OPENAI_API_KEY)

def get_pending_transactions(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, amount, merchant, customer_email, customer_ssn, account_number
        FROM transactions
        WHERE risk_score IS NULL
        AND created_at > NOW() - INTERVAL '24 hours'
    """)
    return cur.fetchall()


def score_transaction(tx):
    """Score a transaction for fraud risk using GPT-4o."""
    tx_id, amount, merchant, email, ssn, account = tx

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": "You are a fraud detection system. Score transactions 0-100."
        }, {
            "role": "user",
            "content": f"Score this transaction:\nAmount: ${amount}\nMerchant: {merchant}\nCustomer: {email}, SSN: {ssn}, Account: {account}\nProvide a risk score 0-100 and brief explanation."
        }]
    )

    return response.choices[0].message.content


def run_batch_scoring():
    conn = psycopg2.connect(host="prod-db.internal", database="acme_finance")

    transactions = get_pending_transactions(conn)
    print(f"Scoring {len(transactions)} transactions...")

    for tx in transactions:
        score_text = score_transaction(tx)

        # Write AI score directly to production database
        cur = conn.cursor()
        cur.execute(
            "UPDATE transactions SET risk_score = %s, scored_at = %s WHERE id = %s",
            (score_text, datetime.now(), tx[0])
        )
        conn.commit()

    conn.close()
    print("Batch scoring complete.")


if __name__ == "__main__":
    run_batch_scoring()
