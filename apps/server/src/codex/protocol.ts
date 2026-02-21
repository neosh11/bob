export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcServerRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification | JsonRpcServerRequest;

export type CodexTurnStatus = "completed" | "interrupted" | "failed" | "inProgress";

export interface CodexThread {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  turns: CodexTurn[];
}

export interface CodexTurn {
  id: string;
  status: CodexTurnStatus;
  items: CodexThreadItem[];
  error: {
    message: string;
  } | null;
}

export type CodexUserInput =
  | {
      type: "text";
      text: string;
      text_elements: Array<unknown>;
    }
  | {
      type: "image";
      url: string;
    }
  | {
      type: "localImage";
      path: string;
    }
  | {
      type: "skill";
      name: string;
      path: string;
    }
  | {
      type: "mention";
      name: string;
      path: string;
    };

export type CodexThreadItem =
  | {
      type: "userMessage";
      id: string;
      content: CodexUserInput[];
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
    }
  | {
      type: "plan";
      id: string;
      text: string;
    }
  | {
      type: "reasoning";
      id: string;
      summary: string[];
      content: string[];
    }
  | {
      type: "commandExecution";
      id: string;
      aggregatedOutput: string | null;
    }
  | {
      type: "fileChange";
      id: string;
    };

export interface ThreadStartResponse {
  thread: CodexThread;
}

export interface ThreadResumeResponse {
  thread: CodexThread;
}

export interface ThreadForkResponse {
  thread: CodexThread;
}

export interface ThreadReadResponse {
  thread: CodexThread;
}

export interface ThreadListResponse {
  data: CodexThread[];
  nextCursor: string | null;
}

export interface TurnStartResponse {
  turn: CodexTurn;
}

export interface LoginAccountResponse {
  type: "apiKey" | "chatgpt" | "chatgptAuthTokens";
  authUrl?: string;
  loginId?: string;
}

export interface AccountResponse {
  requiresOpenaiAuth: boolean;
  account:
    | null
    | {
        type: "apiKey";
      }
    | {
        type: "chatgpt";
        email: string;
        planType: string;
      };
}

export interface AccountLoginCompletedNotification {
  loginId: string | null;
  success: boolean;
  error: string | null;
}

export interface TurnStartedNotification {
  threadId: string;
  turn: {
    id: string;
    status: CodexTurnStatus;
  };
}

export interface TurnCompletedNotification {
  threadId: string;
  turn: {
    id: string;
    status: CodexTurnStatus;
    error?: {
      message: string;
    } | null;
  };
}

export interface AgentMessageDeltaNotification {
  threadId: string;
  turnId: string;
  delta: string;
}

export interface CommandOutputDeltaNotification {
  threadId: string;
  turnId: string;
  delta: string;
}

export interface ItemStartedNotification {
  threadId?: string;
  turnId?: string;
  item: {
    type: string;
    id: string;
  };
}

export interface ItemCompletedNotification {
  threadId?: string;
  turnId?: string;
  item:
    | {
        type: "agentMessage";
        id: string;
        text: string;
      }
    | {
        type: "commandExecution";
        id: string;
        aggregatedOutput?: string | null;
      }
    | {
        type: string;
        id: string;
      };
}
