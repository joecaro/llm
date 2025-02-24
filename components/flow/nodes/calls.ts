import { Node } from "@xyflow/react";

export default [
  {
    id: "calls_group",
    type: "groupNode",
    position: { x: -210, y: 290 },
    style: {
      width: 400,
      height: 120,
      backgroundColor: "rgba(255, 243, 230, 0.5)",
      borderRadius: "8px",
      border: "1px solid #ffb74d",
    },
    data: { label: "calls.py calls router" },
  },
  {
    id: "calls_router",
    position: { x: 130, y: 20 },
    data: { label: "CallsRouter" },
    parentId: "calls_group",
  },
  {
    id: "make-dials",
    position: { x: 10, y: 70 },
    data: { label: "/make_dials" },
    parentId: "calls_group",
  },
  {
    id: "handle_call_status",
    position: { x: 240, y: 70 },
    data: { label: "status" },
    parentId: "calls_group",
  },
] as Node[];
