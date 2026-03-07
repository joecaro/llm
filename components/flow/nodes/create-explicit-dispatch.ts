const createExplicitDispatch = [
  {
    id: "create_explicit_dispatch",
    type: "groupNode",
    style: {
      width: 170,
      height: 200,
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    position: { x: 10, y: 170 },
    data: { label: "create_explicit_dispatch" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "LiveKitAPI",
    position: { x: 10, y: 40 },
    data: { label: "LiveKitAPI" },
    parentId: "create_explicit_dispatch",
  },
  {
    id: "LiveKitAPI_create_dispatch",
    position: { x: 10, y: 90 },
    data: { label: "LiveKitAPI_create_dispatch" },
    parentId: "create_explicit_dispatch",
  },
  {
    id: "LiveKitAPI_list_dispatch",
    position: { x: 10, y: 140 },
    data: { label: "LiveKitAPI_list_dispatch" },
    parentId: "create_explicit_dispatch",
  },
];

export default createExplicitDispatch;
