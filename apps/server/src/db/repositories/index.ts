import type Database from "better-sqlite3";

import { MessageRepository } from "./messageRepository.js";
import { RunRepository } from "./runRepository.js";
import { SessionRepository } from "./sessionRepository.js";
import { UserRepository } from "./userRepository.js";
import { AuditRepository } from "./auditRepository.js";

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  messages: MessageRepository;
  runs: RunRepository;
  audit: AuditRepository;
}

export function createRepositories(db: Database.Database): Repositories {
  return {
    users: new UserRepository(db),
    sessions: new SessionRepository(db),
    messages: new MessageRepository(db),
    runs: new RunRepository(db),
    audit: new AuditRepository(db)
  };
}
