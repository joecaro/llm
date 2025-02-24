import { Node } from "@xyflow/react";

export default [
  {
    id: "langgraph_group",
    type: "groupNode",
    position: { x: 1420, y: 710 },
    style: {
      width: 300,
      height: 90,
      backgroundColor: "rgba(230, 245, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #90caf9",
    },
    data: { label: "LangGraph" },
  },
  {
    id: "langgraph_agent",
    position: { x: 10, y: 40 },
    data: { label: "agent" },
    parentId: "langgraph_group",
  },
] as Node[];
