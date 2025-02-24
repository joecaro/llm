import { Node } from "@xyflow/react";

export default [
  {
    id: "outbound_call_handler",
    type: "groupNode",
    position: { x: 270, y: 770 },
    data: { label: "outbound_call_handler.py" },
    style: {
      width: 400,
      height: 190,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ccc",
    },
  },
  {
    id: "handle_outbound_call_livekit",
    position: { x: 100, y: 40 },
    style: { width: 200 },
    data: { label: "handle_outbound_call_livekit" },
    parentId: "outbound_call_handler",
  },
  {
    id: "get_or_create_outbound_trunk",
    position: { x: 100, y: 90 },
    style: { width: 200 },
    data: { label: "get_or_create_outbound_trunk" },
    parentId: "outbound_call_handler",
  },
  {
    id: "LiveKitOutboundCall_creation",
    position: { x: 100, y: 140 },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
      width: 200,
    },
    data: { label: "LiveKitOutboundCall_creation" },
    parentId: "outbound_call_handler",
  },
] as Node[];
