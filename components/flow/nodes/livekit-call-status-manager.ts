import { Node } from "@xyflow/react";

export default [
  {
    id: "livekit_call_status_manager_group",
    type: "groupNode",
    position: { x: 1420, y: 920 },
    style: {
      width: 340,
      height: 200,
      backgroundColor: "rgba(240, 240, 250, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    data: { label: "LiveKitCallStatusManager" },
  },
  {
    id: "manage_call",
    position: { x: 10, y: 40 },
    data: { label: "manage_call" },
    parentId: "livekit_call_status_manager_group",
  },
  {
    id: "update_call_state",
    position: { x: 10, y: 90 },
    data: { label: "update_call_state" },
    parentId: "livekit_call_status_manager_group",
  },
  {
    id: "sleep_state",
    position: { x: 10, y: 140 },
    data: { label: "asyncio.sleep(1)" },
    parentId: "livekit_call_status_manager_group",
  },
  {
    id: "recording_manager",
    position: { x: 170, y: 40 },
    data: { label: "recording_manager" },
    parentId: "livekit_call_status_manager_group",
  },
  {
    id: "transfer_manager",
    position: { x: 170, y: 90 },
    data: { label: "transfer_manager" },
    parentId: "livekit_call_status_manager_group",
  },
  {
    id: "other_managers",
    position: { x: 170, y: 140 },
    data: { label: "other_managers" },
    parentId: "livekit_call_status_manager_group",
  },
] as Node[];
