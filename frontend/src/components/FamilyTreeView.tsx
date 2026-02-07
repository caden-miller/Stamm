import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchFamily } from "../api/client";
import type { FamilyData, FamilyMemberBrief } from "../api/types";

interface TreeNode {
  person: FamilyMemberBrief;
  family: FamilyData | null;
  expanded: boolean;
  loading: boolean;
}

interface Props {
  rootPersonId: number;
  rootPersonName: string;
}

const REL_COLORS: Record<string, string> = {
  parent: "#4e9e6e",
  spouse: "#c55088",
  child: "#5088c5",
};

export default function FamilyTreeView({ rootPersonId, rootPersonName }: Props) {
  const [nodes, setNodes] = useState<Map<number, TreeNode>>(new Map());
  const [rootLoaded, setRootLoaded] = useState(false);

  const loadNode = useCallback(async (personId: number) => {
    setNodes((prev) => {
      const copy = new Map(prev);
      const existing = copy.get(personId);
      if (existing) {
        copy.set(personId, { ...existing, loading: true });
      } else {
        copy.set(personId, {
          person: { id: personId, display_name: "", sex: null },
          family: null,
          expanded: true,
          loading: true,
        });
      }
      return copy;
    });

    try {
      const family = await fetchFamily(personId);
      setNodes((prev) => {
        const copy = new Map(prev);
        copy.set(personId, {
          person: family.person,
          family,
          expanded: true,
          loading: false,
        });
        return copy;
      });
    } catch {
      setNodes((prev) => {
        const copy = new Map(prev);
        const existing = copy.get(personId);
        if (existing) copy.set(personId, { ...existing, loading: false });
        return copy;
      });
    }
  }, []);

  const toggleNode = useCallback(
    (personId: number) => {
      const node = nodes.get(personId);
      if (!node || !node.family) {
        loadNode(personId);
      } else {
        setNodes((prev) => {
          const copy = new Map(prev);
          copy.set(personId, { ...node, expanded: !node.expanded });
          return copy;
        });
      }
    },
    [nodes, loadNode],
  );

  // Load root on first render
  if (!rootLoaded) {
    setRootLoaded(true);
    loadNode(rootPersonId);
  }

  const rootNode = nodes.get(rootPersonId);

  return (
    <div className="space-y-1">
      {rootNode ? (
        <TreeNodeRow
          node={rootNode}
          depth={0}
          relation={null}
          nodes={nodes}
          onToggle={toggleNode}
        />
      ) : (
        <div className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
          Loading tree for {rootPersonName}...
        </div>
      )}
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  relation,
  nodes,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  relation: string | null;
  nodes: Map<number, TreeNode>;
  onToggle: (id: number) => void;
}) {
  const { person, family, expanded, loading } = node;
  const hasFamily = family && (family.parents.length > 0 || family.spouses.length > 0 || family.children.length > 0);
  const sexColor = person.sex === "M" ? "#5088c5" : person.sex === "F" ? "#c55088" : "var(--text-muted)";

  return (
    <div>
      {/* This person's row */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => onToggle(person.id)}
          className="w-5 h-5 flex items-center justify-center rounded text-xs shrink-0 transition-colors"
          style={{
            color: expanded ? "var(--gold)" : "var(--text-muted)",
            background: expanded ? "rgba(200, 163, 78, 0.1)" : "transparent",
          }}
        >
          {loading ? (
            <span className="animate-spin">⟳</span>
          ) : expanded && hasFamily ? (
            "▾"
          ) : (
            "▸"
          )}
        </button>

        {/* Sex indicator dot */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: sexColor }}
        />

        {/* Relation tag */}
        {relation && (
          <span
            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: `${REL_COLORS[relation] ?? "var(--text-muted)"}20`,
              color: REL_COLORS[relation] ?? "var(--text-muted)",
            }}
          >
            {relation}
          </span>
        )}

        {/* Name */}
        <Link
          to={`/people/${person.id}`}
          className="text-sm font-medium hover:underline truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {person.display_name || "(Loading...)"}
        </Link>
      </div>

      {/* Expanded children: parents, spouses, children */}
      {expanded && family && (
        <div>
          {/* Parents */}
          {family.parents.map((p) => {
            const childNode = nodes.get(p.id);
            return childNode ? (
              <TreeNodeRow
                key={`parent-${p.id}`}
                node={childNode}
                depth={depth + 1}
                relation="parent"
                nodes={nodes}
                onToggle={onToggle}
              />
            ) : (
              <CollapsedRow
                key={`parent-${p.id}`}
                person={p}
                depth={depth + 1}
                relation="parent"
                onExpand={() => onToggle(p.id)}
              />
            );
          })}

          {/* Spouses */}
          {family.spouses.map((s) => {
            const childNode = nodes.get(s.id);
            return childNode ? (
              <TreeNodeRow
                key={`spouse-${s.id}`}
                node={childNode}
                depth={depth + 1}
                relation="spouse"
                nodes={nodes}
                onToggle={onToggle}
              />
            ) : (
              <CollapsedRow
                key={`spouse-${s.id}`}
                person={s}
                depth={depth + 1}
                relation="spouse"
                onExpand={() => onToggle(s.id)}
              />
            );
          })}

          {/* Children */}
          {family.children.map((c) => {
            const childNode = nodes.get(c.id);
            return childNode ? (
              <TreeNodeRow
                key={`child-${c.id}`}
                node={childNode}
                depth={depth + 1}
                relation="child"
                nodes={nodes}
                onToggle={onToggle}
              />
            ) : (
              <CollapsedRow
                key={`child-${c.id}`}
                person={c}
                depth={depth + 1}
                relation="child"
                onExpand={() => onToggle(c.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsedRow({
  person,
  depth,
  relation,
  onExpand,
}: {
  person: FamilyMemberBrief;
  depth: number;
  relation: string;
  onExpand: () => void;
}) {
  const sexColor = person.sex === "M" ? "#5088c5" : person.sex === "F" ? "#c55088" : "var(--text-muted)";

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors group"
      style={{ paddingLeft: `${depth * 24 + 12}px` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button
        onClick={onExpand}
        className="w-5 h-5 flex items-center justify-center rounded text-xs shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        ▸
      </button>

      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: sexColor }}
      />

      <span
        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
        style={{
          background: `${REL_COLORS[relation] ?? "var(--text-muted)"}20`,
          color: REL_COLORS[relation] ?? "var(--text-muted)",
        }}
      >
        {relation}
      </span>

      <button
        onClick={onExpand}
        className="text-sm truncate hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        {person.display_name}
      </button>
    </div>
  );
}
