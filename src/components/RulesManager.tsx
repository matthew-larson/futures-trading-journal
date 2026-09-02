import { useState } from "react";
import {
  Plus,
  Ruler,
  Pencil,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { TradingRule, RuleInput, RuleCategory } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";

interface RulesManagerProps {
  rules: TradingRule[];
  onAdd: (input: RuleInput) => Promise<void>;
  onUpdate: (id: string, input: RuleInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
}

const categoryColors: Record<RuleCategory, string> = {
  risk: "border-bear-500/30 bg-bear-500/10 text-bear-500",
  entry: "border-info-500/30 bg-info-500/10 text-info-400",
  exit: "border-accent-500/30 bg-accent-500/10 text-accent-400",
  psychology: "border-bull-500/30 bg-bull-500/10 text-bull-500",
  timing: "border-base-600 bg-base-700/50 text-base-200",
  general: "border-base-600 bg-base-700/50 text-base-200",
};

const categories: RuleCategory[] = ["risk", "entry", "exit", "psychology", "timing", "general"];

export function RulesManager({
  rules,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: RulesManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TradingRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TradingRule | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (rule: TradingRule) => {
    setEditing(rule);
    setModalOpen(true);
  };

  const handleSave = async (input: RuleInput) => {
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, input);
      } else {
        await onAdd(input);
      }
      setModalOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-base-50">Trading Rules</h2>
          <p className="text-sm text-base-400">
            {rules.length} total · {activeCount} active
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500"
        >
          <Plus size={18} /> Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Ruler size={28} />}
          title="No rules defined yet"
          description="Create trading rules to score compliance on every trade. Rules help you stay disciplined and identify patterns in your behavior."
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
            >
              <Plus size={18} /> Create your first rule
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`group rounded-xl border bg-base-850 p-4 transition-colors ${
                rule.is_active
                  ? "border-base-700 hover:border-base-600"
                  : "border-base-800 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-base-800 p-2 text-base-400">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-base-100">{rule.name}</h3>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryColors[rule.category]}`}
                      >
                        {rule.category}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="mt-1 text-sm text-base-400">{rule.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => onToggle(rule.id, !rule.is_active)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    rule.is_active
                      ? "text-bull-500 hover:text-bull-400"
                      : "text-base-500 hover:text-base-300"
                  }`}
                >
                  {rule.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {rule.is_active ? "Active" : "Inactive"}
                </button>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(rule)}
                    className="rounded-lg p-1.5 text-base-400 transition-colors hover:bg-base-700 hover:text-base-100"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(rule)}
                    className="rounded-lg p-1.5 text-base-400 transition-colors hover:bg-bear-600/20 hover:text-bear-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Rule" : "Add Trading Rule"}
        subtitle={editing ? "Update the rule details" : "Define a rule to track on every trade"}
        size="md"
      >
        <RuleForm
          rule={editing}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete rule?"
        message={`"${deleteTarget?.name}" will be removed. Trades that referenced this rule will keep their compliance data but the rule name will no longer appear.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RuleForm({
  rule,
  saving,
  onSave,
  onCancel,
}: {
  rule: TradingRule | null;
  saving: boolean;
  onSave: (input: RuleInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [category, setCategory] = useState<RuleCategory>(rule?.category ?? "general");
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Rule name is required");
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      category,
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-base-300">Rule Name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. No trading before 9:30 AM"
          className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-base-100 outline-none transition-colors focus:border-info-500 placeholder:text-base-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-base-300">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain what this rule means and why it matters..."
          className="min-h-[80px] w-full resize-y rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-base-100 outline-none transition-colors focus:border-info-500 placeholder:text-base-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-base-300">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as RuleCategory)}
          className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-base-100 outline-none transition-colors focus:border-info-500"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-base-600 bg-base-800"
        />
        <span className="text-sm text-base-300">Active (available for compliance scoring)</span>
      </label>

      {error && <p className="text-xs text-bear-500">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-base-700 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-base-600 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
        >
          {saving ? "Saving..." : rule ? "Save Changes" : "Add Rule"}
        </button>
      </div>
    </form>
  );
}
