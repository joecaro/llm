import { Node } from "@xyflow/react";

export default [
  {
    id: "helpers_group",
    type: "groupNode",
    position: { x: 70, y: 530 },
    style: {
      width: 180,
      height: 390,
      backgroundColor: "rgba(230, 245, 255, 0.5)",
      borderRadius: "8px",
      border: "1px solid #90caf9",
    },
    data: { label: "helpers.py" },
  },
  {
    id: "register_with_dial_manager",
    position: { x: 10, y: 40 },
    data: { label: "register_with_dial_manager" },
    parentId: "helpers_group",
  },
  {
    id: "get_base_url",
    position: { x: 10, y: 90 },
    data: { label: "get_base_url" },
    parentId: "helpers_group",
  },
  {
    id: "get_campaign_id",
    position: { x: 10, y: 140 },
    data: { label: "get_campaign_id" },
    parentId: "helpers_group",
  },
  {
    id: "get_instance_agent_name",
    position: { x: 10, y: 190 },
    data: { label: "get_instance_agent_name" },
    parentId: "helpers_group",
  },
  {
    id: "set_is_worker_calling",
    position: { x: 10, y: 240 },
    data: { label: "set_is_worker_calling" },
    parentId: "helpers_group",
  },
  {
    id: "setup_agent_id",
    position: { x: 10, y: 290 },
    data: { label: "setup_agent_id" },
    parentId: "helpers_group",
  },
  {
    id: "update_agent_mapping",
    position: { x: 10, y: 340 },
    data: { label: "update_agent_mapping" },
    parentId: "helpers_group",
  },
] as Node[];
