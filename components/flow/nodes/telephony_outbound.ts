import { Node } from "@xyflow/react";

export default [
  {
    id: "telephony_outbound_group",
    type: "groupNode",
    position: { x: 270, y: 290 },
    style: {
      width: 400,
      height: 230,
      backgroundColor: "rgba(240, 240, 240, 0.5)",
      borderRadius: "8px",
      border: "1px solid #ccc",
    },
    data: { label: "telephony_outbound.py" },
  },
  {
    id: "lifespan",
    position: { x: 150, y: 10 },
    data: { label: "lifespan" },
    parentId: "telephony_outbound_group",
  },
  {
    id: "run_livekit_worker",
    position: { x: 230, y: 60 },
    data: { label: "run_livekit_worker" },
    parentId: "telephony_outbound_group",
  },
  {
    id: "run_forever",
    position: { x: 230, y: 110 },
    data: { label: "_run_forever" },
    parentId: "telephony_outbound_group",
  },
  {
    id: "run_worker_async",
    position: { x: 230, y: 160 },
    data: { label: "run_worker_async" },
    parentId: "telephony_outbound_group",
  },
  {
    id: "start_worker",
    position: { x: 30, y: 130 },
    data: { label: "start_worker" },
    parentId: "telephony_outbound_group",
  },
] as Node[];
