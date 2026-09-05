import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@mui/material";
import { Icon } from "../../../shared/components/Icon.jsx";

export function ShellMicrofrontList({ microfronts = [], branchOperation, buildOperation, operations = {}, onChangeBranch, onChangeBranchBatch, onBuildBatch, onRefresh }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingBuild, setPendingBuild] = useState(null);
  const [pendingBranch, setPendingBranch] = useState(null);
  const [branchOverrides, setBranchOverrides] = useState({});
  const [localBuildOverrides, setLocalBuildOverrides] = useState({});
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return microfronts.filter((item) => !q || `${item.name} ${item.path} ${item.branch || ""}`.toLowerCase().includes(q));
  }, [microfronts, query]);
  const selected = microfronts.filter((item) => selectedIds.includes(item.id));
  const selectedSet = new Set(selectedIds);
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedSet.has(item.id));
  const branches = useMemo(() => {
    if (!selected.length) return [];
    return [...new Set(selected[0].branches || [])].filter((branch) => selected.every((item) => item.branches?.includes(branch))).sort();
  }, [selected]);
  const busy = submitting || branchOperation?.status === "running" || buildOperation?.status === "running";

  useEffect(() => setSelectedIds((current) => current.filter((id) => microfronts.some((item) => item.id === id))), [microfronts]);
  useEffect(() => {
    const isCurrentOperation = buildOperation?.startedAt && buildOperation.startedAt !== pendingBuild?.previousStartedAt;
    if (buildOperation?.status === "running" && isCurrentOperation) setPendingBuild(null);
    if (["success", "error"].includes(buildOperation?.status) && isCurrentOperation) {
      if (buildOperation?.status === "success") {
        const completed = buildOperation.completedIds || (buildOperation.microfrontendId ? [buildOperation.microfrontendId] : []);
        setLocalBuildOverrides((current) => ({ ...current, ...Object.fromEntries(completed.map((id) => [id, true])) }));
      }
      setSubmitting(false);
      setPendingBuild(null);
    }
  }, [buildOperation?.status, buildOperation?.startedAt, pendingBuild]);
  useEffect(() => {
    if (!pendingBranch) return;
    const rowOperations = pendingBranch.ids.map((id) => operations[`branch:${id}`]);
    const areCurrentOperations = rowOperations.every((operation) => operation?.startedAt && operation.startedAt !== pendingBranch.previousStartedAt);
    if (!areCurrentOperations || !rowOperations.every((operation) => ["success", "error"].includes(operation?.status))) return;
    const completedIds = pendingBranch.ids.filter((id) => operations[`branch:${id}`]?.status === "success");
    setBranchOverrides((current) => ({ ...current, ...Object.fromEntries(completedIds.map((id) => [id, pendingBranch.branch])) }));
    setPendingBranch(null);
    setSubmitting(false);
  }, [operations, pendingBranch]);
  useEffect(() => setBranchOverrides((current) => Object.fromEntries(Object.entries(current).filter(([id, branch]) => microfronts.find((item) => item.id === id)?.branch !== branch))), [microfronts]);
  useEffect(() => setLocalBuildOverrides((current) => Object.fromEntries(Object.entries(current).filter(([id, available]) => microfronts.find((item) => item.id === id)?.localBuildAvailable !== available))), [microfronts]);

  const toggle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => {
    const ids = new Set(visible.map((item) => item.id));
    return allVisibleSelected ? current.filter((id) => !ids.has(id)) : [...new Set([...current, ...ids])];
  });
  const operationFor = (microfront) => {
    const branchRowOperation = operations[`branch:${microfront.id}`];
    const buildRowOperation = operations[`build:${microfront.id}`];
    const isNewBuild = buildRowOperation?.startedAt && buildRowOperation.startedAt !== pendingBuild?.previousStartedAt;
    const isNewBranch = branchRowOperation?.startedAt && branchRowOperation.startedAt !== pendingBranch?.previousStartedAt;
    if (pendingBuild?.ids.includes(microfront.id) && !isNewBuild) return { tone: "starting", label: "Preparando", detail: "Enviando la compilación al servidor." };
    if (pendingBranch?.ids.includes(microfront.id) && !isNewBranch) return { tone: "starting", label: "Preparando", detail: "Enviando el cambio de rama al servidor." };
    const rowOperation = [branchRowOperation, buildRowOperation]
      .filter(Boolean)
      .sort((left, right) => Date.parse(right.startedAt || 0) - Date.parse(left.startedAt || 0))[0];
    if (rowOperation && rowOperation.status !== "idle") return { tone: rowOperation.status === "error" ? "error" : rowOperation.status === "success" ? "active" : "starting", label: rowOperation.status === "error" ? rowOperation.error || "Error" : rowOperation.message, detail: rowOperation.error || rowOperation.message };
    if (pendingBuild?.ids.includes(microfront.id)) return { tone: "starting", label: "Preparando compilación…", detail: "Enviando la compilación al servidor." };
    if (pendingBranch?.ids.includes(microfront.id)) {
      if (branchOperation?.status === "error" && branchOperation.microfrontendId === microfront.id) return { tone: "error", label: branchOperation.error || "Error al cambiar rama", detail: branchOperation.error || branchOperation.message };
      if (branchOperation?.status !== "running") return { tone: "starting", label: "Preparando cambio…", detail: "Enviando el cambio de rama al servidor." };
    }
    const batchOperation = [buildOperation, branchOperation].find((item) => item?.batchIds?.includes(microfront.id));
    if (batchOperation) {
      if (batchOperation.completedIds?.includes(microfront.id)) return { tone: "active", label: "Completado", detail: batchOperation.message };
      if (batchOperation.microfrontendId === microfront.id) return { tone: batchOperation.status === "error" ? "error" : "starting", label: batchOperation.status === "error" ? batchOperation.error || "Error" : batchOperation.message, detail: batchOperation.error || batchOperation.message };
      return { tone: "idle", label: "En cola", detail: "Pendiente de procesarse." };
    }
    const operation = buildOperation?.microfrontendId === microfront.id ? buildOperation : branchOperation?.microfrontendId === microfront.id ? branchOperation : null;
    if (!operation || operation.status === "idle") return { tone: "idle", label: "—", detail: "Sin proceso activo." };
    if (operation.status === "running") return { tone: "starting", label: operation.message || "En curso", detail: operation.message };
    if (operation.status === "error") return { tone: "error", label: operation.error || "Error", detail: operation.error || operation.message };
    return { tone: "active", label: "Completado", detail: operation.message };
  };
  const branchIsChanging = (microfront) => {
    const operation = operations[`branch:${microfront.id}`];
    const isNewOperation = operation?.startedAt && operation.startedAt !== pendingBranch?.previousStartedAt;
    return operation?.status === "running" || (pendingBranch?.ids.includes(microfront.id) && !isNewOperation);
  };
  const buildIsRunning = (microfront) => {
    const operation = operations[`build:${microfront.id}`];
    const isNewOperation = operation?.startedAt && operation.startedAt !== pendingBuild?.previousStartedAt;
    return operation?.status === "running" || (pendingBuild?.ids.includes(microfront.id) && !isNewOperation) || (buildOperation?.status === "running" && buildOperation.microfrontendId === microfront.id);
  };
  const chooseAction = (action) => {
    setBulkAction(action);
    setTargetBranch("");
  };
  const applyBuild = () => {
    const eligible = selected.filter((item) => item.buildAvailable);
    if (!eligible.length) return;
    setPendingBuild({ ids: eligible.map((item) => item.id), previousStartedAt: buildOperation?.startedAt });
    setSubmitting(true);
    Promise.resolve(onBuildBatch?.(eligible)).catch(() => {
      setPendingBuild(null);
      setSubmitting(false);
    });
  };
  const applyBranch = () => {
    if (!targetBranch || !selected.length) return;
    setPendingBranch({ ids: selected.map((item) => item.id), branch: targetBranch, previousStartedAt: branchOperation?.startedAt });
    setSubmitting(true);
    Promise.resolve(onChangeBranchBatch?.(selected, targetBranch)).catch(() => {
      setPendingBranch(null);
      setSubmitting(false);
    });
  };

  return <section className="shell-microfronts" aria-labelledby="shell-microfronts-title">
    <header className="shell-microfronts-header">
      <div><h3 id="shell-microfronts-title">Microfronts locales</h3><p>{microfronts.length} detectados para esta shell.</p></div>
      {selected.length ? <div className="microfront-bulk-toolbar">
        <strong>{selected.length} {selected.length === 1 ? "microfront seleccionado" : "microfronts seleccionados"}</strong>
        <select aria-label="Acción masiva" value={bulkAction} disabled={busy} onChange={(event) => chooseAction(event.target.value)}><option value="">Acciones masivas…</option><option value="build">Compilar seleccionados</option><option value="branch">Cambiar a rama…</option></select>
        {bulkAction === "build" && <button className="button primary" disabled={busy || !selected.some((item) => item.buildAvailable)} onClick={applyBuild}>Aplicar</button>}
        {bulkAction === "branch" && <><select aria-label="Rama destino" value={targetBranch} disabled={busy || !branches.length} onChange={(event) => setTargetBranch(event.target.value)}><option value="">{branches.length ? "Seleccionar rama…" : "Sin ramas comunes"}</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select><button className="button primary" disabled={busy || !targetBranch} onClick={applyBranch}>Aplicar</button></>}
      </div> : <div className="microfront-default-toolbar"><label className="microfront-search"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar microfront…" /></label><button className="button ghost" onClick={onRefresh}><Icon name="refresh" size={14} />Actualizar</button></div>}
    </header>
    {microfronts.length ? <><div className="shell-microfront-columns"><span className="microfront-header-checkbox"><Checkbox size="small" checked={allVisibleSelected} indeterminate={selected.length > 0 && !allVisibleSelected} onChange={toggleVisible} inputProps={{ "aria-label": "Seleccionar resultados visibles" }} /></span><span>Microfront</span><span>Rama actual</span><span>Build local</span><span>Chequeo de proceso</span></div><ul>
      {visible.map((microfront) => {
        const operation = operationFor(microfront);
        const changingBranch = branchIsChanging(microfront);
        const building = buildIsRunning(microfront);
        const shownBranch = branchOverrides[microfront.id] || microfront.branch || "No disponible";
        const localBuildAvailable = localBuildOverrides[microfront.id] ?? microfront.localBuildAvailable;
        return <li key={microfront.id} className={selectedSet.has(microfront.id) ? "selected" : ""}>
          <span className="microfront-select"><Checkbox size="small" checked={selectedSet.has(microfront.id)} onChange={() => toggle(microfront.id)} inputProps={{ "aria-label": `Seleccionar ${microfront.name}` }} /></span>
          <div className="microfront-identity"><Icon name="package" size={16} /><div><strong>{microfront.name}</strong><code title={microfront.path}>{microfront.path}</code></div></div>
          <span className={`microfront-branch-value ${changingBranch ? "changing" : ""}`} title={changingBranch ? branchOperation?.message || "Preparando cambio de rama." : shownBranch}><Icon name="branch" size={14} /><i />{changingBranch ? "Cambiando rama…" : shownBranch}</span>
          <span className={`microfront-build-status ${building ? "building" : localBuildAvailable ? "available" : "unavailable"}`}><i />{building ? (localBuildAvailable ? "Reconstruyendo…" : "Preparando construcción…") : localBuildAvailable ? "Disponible" : "No disponible"}</span>
          <span className={`microfront-operation-state ${operation.tone}`}><i />{operation.label}</span>
        </li>;
      })}
    </ul>{visible.length === 0 && <p className="microfront-empty">No hay microfronts que coincidan con la búsqueda.</p>}</> : <p className="microfront-empty">Esta shell no tiene microfronts locales detectados.</p>}
  </section>;
}
