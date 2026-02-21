export interface AuthUser {
  id: string;
  username: string;
}

export interface CodexAccountStatus {
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

export interface CodexLoginStartResult {
  login:
    | {
        type: "apiKey";
      }
    | {
        type: "chatgpt";
        loginId: string;
        authUrl: string;
      }
    | {
        type: "chatgptAuthTokens";
      };
}
