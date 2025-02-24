import { Node } from "@xyflow/react";

export default [
  {
    id: "base_dialer_group",
    type: "groupNode",
    position: { x: 270, y: 530 },
    style: {
      width: 220,
      height: 230,
      backgroundColor: "rgba(255, 240, 240, 0.5)",
      borderRadius: "8px",
      border: "1px solid #ff8a80",
    },
    data: { label: "base_pre_call_dialer.py" },
  },
  {
    id: "run_dialer",
    position: { x: 30, y: 30 },
    data: { label: "run" },
    parentId: "base_dialer_group",
  },
  {
    id: "set_up_environment",
    position: { x: 30, y: 80 },
    data: { label: "set_up_environment" },
    parentId: "base_dialer_group",
  },
  {
    id: "business_hours_check",
    position: { x: 30, y: 130 },
    data: { label: "business_hours_check" },
    parentId: "base_dialer_group",
  },
  {
    id: "get_next_customer",
    position: { x: 30, y: 180 },
    data: { label: "get_next_customer" },
    parentId: "base_dialer_group",
  },
] as Node[];
