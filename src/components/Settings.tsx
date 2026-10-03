import { useState } from "react";
import { ArrowLeft, Download, Trash2, Loader2, AlertCircle, CheckCircle2, Shield, FileText } from "lucide-react";
import { exportUserData, deleteAccount } from "@/lib/dataExport";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LegalPage } from "@/components/LegalPage";

interface SettingsProps {
  onBack: () => void;
  onSignedOut: () => void;
}

type ViewState = "main" | "terms" | "privacy";

export function Settings({ onBack, onSignedOut }: SettingsProps) {
  const [view, setView] = useState<ViewState>("main");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (view === "terms" || view === "privacy") {
    return <LegalPage onBack={() => setView("main")} type={view} />;
  }

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      await exportUserData();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (e) {
      console.error("Export failed", e);
      setExportError("We couldn't export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      onSignedOut();
    } catch (e) {
      console.error("Account deletion failed", e);
      setDeleteError("We couldn't delete your account. Please try again or contact support.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-base-400 transition-colors hover:text-base-200"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <h1 className="mb-6 text-xl font-bold text-base-50">Settings</h1>

      <div className="space-y-4">
        {/* Data export */}
        <SettingsCard
          icon={<Download size={18} className="text-info-400" />}
          title="Export Your Data"
          description="Download all your trades, rules, coaching conversations, and feedback as a JSON file. You can do this at any time."
        >
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Exporting..." : "Download my data"}
          </button>
          {exportSuccess && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-bull-500">
              <CheckCircle2 size={14} /> Export downloaded successfully.
            </p>
          )}
          {exportError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-bear-500">
              <AlertCircle size={14} /> {exportError}
            </p>
          )}
        </SettingsCard>

        {/* Legal pages */}
        <SettingsCard
          icon={<FileText size={18} className="text-base-300" />}
          title="Legal"
          description="Read the Terms of Service and Privacy Policy that govern your use of EdgePilot."
        >
          <div className="flex gap-3">
            <button
              onClick={() => setView("terms")}
              className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
            >
              <FileText size={16} /> Terms of Service
            </button>
            <button
              onClick={() => setView("privacy")}
              className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
            >
              <Shield size={16} /> Privacy Policy
            </button>
          </div>
        </SettingsCard>

        {/* Account deletion */}
        <SettingsCard
          icon={<Trash2 size={18} className="text-bear-500" />}
          title="Delete Account"
          description="Permanently delete your account and all associated data — trades, rules, screenshots, coaching history, and feedback. This cannot be undone."
          danger
        >
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-2 text-sm font-medium text-bear-500 transition-colors hover:bg-bear-500/20"
          >
            <Trash2 size={16} /> Delete my account
          </button>
          {deleteError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-bear-500">
              <AlertCircle size={14} /> {deleteError}
            </p>
          )}
        </SettingsCard>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        message="This will permanently delete all your trades, rules, screenshots, coaching history, and feedback. This action cannot be undone. Consider exporting your data first."
        confirmLabel={deleting ? "Deleting..." : "Delete everything"}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${danger ? "border-bear-500/20 bg-bear-500/5" : "border-base-700 bg-base-850"}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-base-800">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-base-100">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-base-400">{description}</p>
        </div>
      </div>
      <div className="ml-12">{children}</div>
    </div>
  );
}
