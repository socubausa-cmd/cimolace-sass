import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

const nodeBox = 'rounded-xl border border-white/15 bg-[#0F1419]/90 text-white px-3 py-2 text-xs shadow';

function FlowNode({ title, subtitle, tone = 'gray' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)]'
      : tone === 'emerald'
        ? 'border-emerald-500/40 text-emerald-300'
        : 'border-white/15 text-gray-200';
  return (
    <div className={`${nodeBox} ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="text-[11px] opacity-80 mt-1">{subtitle}</p>
    </div>
  );
}

const nodeTypes = {
  triggerNode: ({ data }) => (
    <div className="relative">
      <FlowNode title={`Trigger: ${data.title}`} subtitle={data.subtitle} tone="amber" />
      <Handle type="source" position={Position.Right} id="out" className="!bg-[var(--school-accent)] !w-2 !h-2" />
    </div>
  ),
  conditionNode: ({ data }) => (
    <div className="relative">
      <Handle type="target" position={Position.Left} id="in" className="!bg-[var(--school-accent)] !w-2 !h-2" />
      <FlowNode title={`Condition: ${data.title}`} subtitle={data.subtitle} tone="gray" />
      <Handle type="source" position={Position.Right} id="yes" className="!bg-emerald-400 !w-2 !h-2 !top-[34%]" />
      <Handle type="source" position={Position.Right} id="no" className="!bg-amber-400 !w-2 !h-2 !top-[66%]" />
    </div>
  ),
  actionNode: ({ data }) => (
    <div className="relative">
      <Handle type="target" position={Position.Left} id="in" className="!bg-emerald-400 !w-2 !h-2" />
      <FlowNode title={`Action: ${data.title}`} subtitle={data.subtitle} tone="emerald" />
    </div>
  ),
};

export default function AutomationFlowCanvas({
  trigger,
  conditionOperator = 'AND',
  conditionRules = [],
  actions = [],
  nodePositions = {},
  onChangeTrigger,
  onChangeConditionOperator,
  onAddConditionRule,
  onUpdateConditionRule,
  onRemoveConditionRule,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  onNodePositionsChange,
}) {
  const yesActions = (actions || []).filter((a) => (a.branch || 'yes') === 'yes');
  const noActions = (actions || []).filter((a) => (a.branch || 'yes') === 'no');

  const conditionLabel = useMemo(() => {
    if (!conditionRules.length) return 'none';
    return conditionRules.map((r) => r.type || 'none').join(` ${conditionOperator} `);
  }, [conditionOperator, conditionRules]);

  const computedNodes = useMemo(() => {
    const base = [
      {
        id: 'trigger',
        type: 'triggerNode',
        position: nodePositions.trigger || { x: 20, y: 120 },
        data: {
          title: trigger,
          subtitle: 'Evenement de depart du flow',
        },
      },
      {
        id: 'condition',
        type: 'conditionNode',
        position: nodePositions.condition || { x: 310, y: 120 },
        data: {
          title: conditionLabel,
          subtitle: `Regles ${conditionOperator}`,
        },
      },
    ];

    let yesOffset = 0;
    let noOffset = 0;
    actions.forEach((a) => {
      const isYes = (a.branch || 'yes') === 'yes';
      const idx = isYes ? yesOffset++ : noOffset++;
      const nodeId = `action-${a.id}`;
      base.push({
        id: nodeId,
        type: 'actionNode',
        position: nodePositions[nodeId] || { x: 620, y: isYes ? 40 + idx * 90 : 250 + idx * 90 },
        data: {
          title: a.actionType || 'send_email',
          subtitle: `Branche ${isYes ? 'YES' : 'NO'}`,
        },
      });
    });
    return base;
  }, [actions, conditionLabel, conditionOperator, nodePositions, trigger]);

  const computedEdges = useMemo(() => {
    const out = [
      {
        id: 'e-trigger-condition',
        source: 'trigger',
        sourceHandle: 'out',
        target: 'condition',
        targetHandle: 'in',
        animated: true,
        style: { stroke: '#D4AF37' },
      },
    ];
    actions.forEach((a) => {
      const isYes = (a.branch || 'yes') === 'yes';
      out.push({
        id: `e-condition-${isYes ? 'yes' : 'no'}-${a.id}`,
        source: 'condition',
        sourceHandle: isYes ? 'yes' : 'no',
        target: `action-${a.id}`,
        targetHandle: 'in',
        label: isYes ? 'YES' : 'NO',
        animated: true,
        style: { stroke: isYes ? '#34d399' : '#f59e0b' },
      });
    });
    return out;
  }, [actions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  const handleNodeDragStop = useCallback(
    (_, draggedNode) => {
      const next = { ...nodePositions, [draggedNode.id]: draggedNode.position };
      onNodePositionsChange?.(next);
    },
    [nodePositions, onNodePositionsChange]
  );

  const handleConnect = useCallback(
    (connection) => {
      const target = String(connection.target || '');
      if (connection.source === 'condition' && target.startsWith('action-')) {
        const actionId = target.replace('action-', '');
        const nextBranch = connection.sourceHandle === 'no' ? 'no' : 'yes';
        onUpdateAction?.(actionId, { branch: nextBranch });
      }
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [onUpdateAction, setEdges]
  );

  const conditionRuleTypes = [
    'none',
    'score_hot',
    'score_warm_or_more',
    'payment_failure_true',
    'abandon_true',
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
          value={trigger}
          onChange={(e) => onChangeTrigger?.(e.target.value)}
        >
          <option value="lead_created">lead_created</option>
          <option value="email_click">email_click</option>
          <option value="signup">signup</option>
          <option value="payment">payment</option>
          <option value="payment_failed">payment_failed</option>
          <option value="abandon">abandon</option>
          <option value="inactivity">inactivity</option>
        </select>
        <select
          className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
          value={conditionOperator}
          onChange={(e) => onChangeConditionOperator?.(e.target.value)}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <button
          type="button"
          className="text-xs px-3 py-2 rounded border border-white/20 text-white hover:bg-white/5"
          onClick={onAddConditionRule}
        >
          + Regle condition
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3 space-y-2">
        <p className="text-xs text-gray-300">Conditions combinees</p>
        {conditionRules.length ? (
          conditionRules.map((rule, idx) => (
            <div key={rule.id} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 w-10">{idx + 1}</span>
              <select
                className="flex-1 bg-[#0F1419] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white"
                value={rule.type}
                onChange={(e) => onUpdateConditionRule?.(rule.id, { type: e.target.value })}
              >
                {conditionRuleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-red-400/30 text-red-200 hover:bg-red-500/15"
                onClick={() => onRemoveConditionRule?.(rule.id)}
              >
                remove
              </button>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-gray-500">Aucune regle: la condition passe automatiquement.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-200">Branche YES</p>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/20"
              onClick={() => onAddAction?.('yes')}
            >
              + action
            </button>
          </div>
          {yesActions.map((a) => (
            <div key={`yes-${a.id}`} className="flex items-center gap-2">
              <select
                className="flex-1 bg-[#0F1419] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white"
                value={a.actionType}
                onChange={(e) => onUpdateAction?.(a.id, { actionType: e.target.value })}
              >
                <option value="send_email">send_email</option>
                <option value="send_notification">send_notification</option>
                <option value="assign_segment">assign_segment</option>
                <option value="launch_campaign">launch_campaign</option>
                <option value="propose_appointment">propose_appointment</option>
                <option value="send_funnel_link">send_funnel_link</option>
              </select>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-red-400/30 text-red-200 hover:bg-red-500/15"
                onClick={() => onRemoveAction?.(a.id)}
              >
                remove
              </button>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-200">Branche NO</p>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded border border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
              onClick={() => onAddAction?.('no')}
            >
              + action
            </button>
          </div>
          {noActions.map((a) => (
            <div key={`no-${a.id}`} className="flex items-center gap-2">
              <select
                className="flex-1 bg-[#0F1419] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white"
                value={a.actionType}
                onChange={(e) => onUpdateAction?.(a.id, { actionType: e.target.value })}
              >
                <option value="send_email">send_email</option>
                <option value="send_notification">send_notification</option>
                <option value="assign_segment">assign_segment</option>
                <option value="launch_campaign">launch_campaign</option>
                <option value="propose_appointment">propose_appointment</option>
                <option value="send_funnel_link">send_funnel_link</option>
              </select>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-red-400/30 text-red-200 hover:bg-red-500/15"
                onClick={() => onRemoveAction?.(a.id)}
              >
                remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[380px] rounded-xl border border-white/10 bg-[#0B1017] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background color="#1f2937" gap={20} />
        </ReactFlow>
      </div>
    </div>
  );
}
