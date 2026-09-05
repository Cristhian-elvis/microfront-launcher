import { useState } from "react";
import Tooltip from "@mui/material/Tooltip";
import { api } from "../../../lib/api.js";
import { Icon } from "../../../shared/components/Icon.jsx";
import { Field, Modal } from "../../../shared/components/Modal.jsx";

export function GlobalSettings({ config, onClose, onSaved }) {
  const [form, setForm] = useState(JSON.parse(JSON.stringify(config)));
  const [error, setError] = useState("");
  const update = (section, key) => (event) =>
    setForm({
      ...form,
      [section]: { ...form[section], [key]: event.target.value },
    });
  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api("/api/config", { method: "PUT", body: JSON.stringify(form) });
      onSaved();
      onClose();
    } catch (exception) {
      setError(exception.message);
    }
  };

  return (
    <Modal
      title="Configuración"
      subtitle="Preferencias globales del launcher."
      onClose={onClose}
      width={740}
    >
      <form onSubmit={save}>
        <div className="modal-body settings-body">
          <div className="setting-group">
            <h3>Rutas del entorno</h3>
            <Field
              label="Raíz de shells"
              value={form.rootPath}
              onChange={(event) =>
                setForm({ ...form, rootPath: event.target.value })
              }
            />
            <Field
              label="Repositorio MOVA UI Components"
              value={form.mova.sourcePath}
              onChange={update("mova", "sourcePath")}
            />
          </div>
          <div className="setting-group">
            <h3>Servidor local</h3>
            <Field
              label={
                <>
                  Puerto del servidor local{" "}
                  <Tooltip
                    title="Se aplica globalmente a todas las shells y a MOVA Components."
                    arrow
                  >
                    <span
                      className="field-help"
                      tabIndex="0"
                      aria-label="Información sobre el puerto local"
                    >
                      ⓘ
                    </span>
                  </Tooltip>
                </>
              }
              type="number"
              value={form.shellDefaults.serverPort}
              onChange={update("shellDefaults", "serverPort")}
            />
          </div>
          <div className="setting-group">
            <h3>Navegador</h3>
            <label className="field">
              <span>Modo de navegador</span>
              <select
                value={form.chrome.browser || "chrome-insecure"}
                onChange={update("chrome", "browser")}
              >
                <option value="chrome">Chrome</option>
                <option value="chrome-insecure">Chrome sin seguridad</option>
                <option value="edge">Edge</option>
                <option value="edge-insecure">Edge sin seguridad</option>
              </select>
            </label>
            <label className="field">
              <span>Si ya hay una ventana abierta</span>
              <select
                value={form.chrome.openMode || ""}
                onChange={update("chrome", "openMode")}
              >
                <option value="">Preguntar cada vez</option>
                <option value="tab">Abrir como nueva pestaña</option>
                <option value="window">Abrir como nueva ventana</option>
              </select>
            </label>
            <label className="field">
              <span>Dirección para abrir</span>
              <select
                value={form.chrome.openHost || "localhost"}
                onChange={update("chrome", "openHost")}
              >
                <option value="localhost">localhost (predeterminado)</option>
                <option value="127.0.0.1">127.0.0.1</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="form-error">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            <Icon name="check" />
            Guardar cambios
          </button>
        </footer>
      </form>
    </Modal>
  );
}
