import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

const TOOLS = [
  {
    name: "lookup_account",
    description: "Look up a customer account by ID",
  },
  {
    name: "create_refund",
    description: "Issue a refund to a customer",
  },
  {
    name: "update_subscription",
    description: "Change a customer's subscription plan",
  },
];

async function executeAction(tool: ToolCall): Promise<unknown> {
  switch (tool.name) {
    case "lookup_account":
      return { id: tool.args.id, balance: 1500.0, status: "active" };
    case "create_refund":
      // Refund processed directly from AI decision
      return { refund_id: "ref-001", amount: tool.args.amount };
    case "update_subscription":
      return { success: true, plan: tool.args.plan };
    default:
      throw new Error(`Unknown tool: ${tool.name}`);
  }
}

export async function handleCustomerRequest(request: string) {
  const response = await client.messages.create({
    model: "claude-3-sonnet",
    max_tokens: 1024,
    system: "You are a customer service agent. Use tools to help customers.",
    messages: [{ role: "user", content: request }],
  });

  // AI decides action → execute without human review
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const result = await executeAction({
      name: toolUse.name,
      args: toolUse.input as Record<string, unknown>,
    });
    return result;
  }

  return response.content[0].type === "text" ? response.content[0].text : null;
}
