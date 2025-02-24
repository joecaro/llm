import { Node } from "@xyflow/react";

export default [
  {
    id: "client_post_call_processor",
    type: "groupNode",
    position: { x: 1420, y: 1130 },
    style: {
      width: 170,
      height: 290,
      backgroundColor: "rgba(255, 250, 230, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ccc",
    },
    data: { label: "client_post_call_processor" },
  },
  {
    id: "process_call",
    position: { x: 10, y: 40 },
    data: { label: "process_call" },
    parentId: "client_post_call_processor",
  },
  {
    id: "get_call_result",
    position: { x: 10, y: 90 },
    data: { label: "get_call_result" },
    parentId: "client_post_call_processor",
  },
  {
    id: "save_call_to_salient",
    position: { x: 10, y: 140 },
    data: { label: "save_call_to_salient" },
    parentId: "client_post_call_processor",
  },
  {
    id: "save_call_to_customer",
    position: { x: 10, y: 190 },
    data: { label: "save_call_to_customer" },
    parentId: "client_post_call_processor",
  },
  {
    id: "clean_up",
    position: { x: 10, y: 240 },
    data: { label: "clean_up" },
    parentId: "client_post_call_processor",
  },
] as Node[];
