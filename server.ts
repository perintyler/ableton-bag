import { startPackServer } from "@barry/tools";
import * as ableton from "@barry-tools/ableton";

// Collect all exported tool definitions
const tools = Object.values(ableton).filter(
  (v): v is (typeof ableton)[keyof typeof ableton] & { name: string; handler: Function } =>
    typeof v === "object" && v !== null && "name" in v && "handler" in v,
);

// stdout is reserved for MCP — use stderr for logging
startPackServer({ name: "ableton", tools });
