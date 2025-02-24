import { Node } from "@xyflow/react";

export const groupNodesByParent = (nodes: Node[]): void => {
  // First, find all group nodes (nodes with type 'groupNode')
  const groupNodes = nodes
    .filter((node) => node.type === "groupNode" || !node.parentId)
    .map((node) => {
      delete node.measured;
      delete node.selected;
      delete node.dragging;
      return node;
    });

  // For each group node, find its children and log the group
  groupNodes
    .sort((a, b) =>
      (a.data as { label: string }).label.localeCompare(
        (b.data as { label: string }).label
      )
    )
    .forEach((groupNode) => {
      const groupWithChildren = [
        groupNode,
        ...nodes
          .filter(
            (node) =>
              node.parentId === groupNode.id && node.type !== "groupNode"
          )
          .map((node) => {
            delete node.measured;
            delete node.selected;
            delete node.dragging;
            return node;
          }),
      ];

      console.log("Node Group:", JSON.stringify(groupWithChildren));
    });
};
