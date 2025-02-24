import { Node } from "@xyflow/react";

export default [
  {
    id: "shutdown_hook_group",
    type: "groupNode",
    position: { x: 410, y: 550 },
    style: {
      width: 170,
      height: 200,
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    data: { label: "shutdown_hook" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "coalesce_livekit_messages",
    position: { x: 10, y: 40 },
    data: { label: "coalesce_livekit_messages" },
    parentId: "shutdown_hook_group",
  },
  {
    id: "print_history",
    position: { x: 10, y: 90 },
    data: { label: "print_history" },
    parentId: "shutdown_hook_group",
  },
  {
    id: "post_call_processor_call",
    position: { x: 10, y: 140 },
    data: { label: "post_call_processor" },
    style: {
      backgroundColor: "rgba(255, 250, 230, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "shutdown_hook_group",
  },
] as Node[];
