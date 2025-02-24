import { Node } from "@xyflow/react";

export default [
  {
    id: "client_dialer_group",
    type: "groupNode",
    position: { x: 500, y: 530 },
    style: {
      width: 170,
      height: 230,
      backgroundColor: "rgba(240, 255, 240, 0.5)",
      borderRadius: "8px",
      border: "1px solid #81c784",
    },
    data: { label: "client_dialer.py" },
  },
  {
    id: "super_run",
    position: { x: 10, y: 40 },
    data: { label: "super.run()" },
    parentId: "client_dialer_group",
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
  },
  {
    id: "set_call_metadata",
    position: { x: 10, y: 150 },
    data: { label: "set_call_metadata" },
    parentId: "client_dialer_group",
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
  },
  {
    id: "set_call_metadata_passthrough",
    position: { x: 680, y: 350 },
    data: { label: "^" },
    style: {
      width: 30,
    },
    sourcePosition: "top",
    targetPosition: "bottom",
  },
] as Node[];
