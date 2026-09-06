import React, { useState } from "react";
import { api } from "../../lib/api.js";
import { Icon } from "./Icon.jsx";
import { Field, Modal } from "./Modal.jsx";

export function ProjectEditor({ project, defaults, onClose, onSaved }) {
  const [form, setForm] = useState(
    project || {
      name: "",
      path: "",
      command: defaults?.shellDefaults?.command || "npm start",
      url: defaults?.shellDefaults?.url || "http://localhost:4200",
      detected: false,
    },
  );
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal
      title={project ? "Configurar shell" : "Agregar shell"}
      subtitle="Los valores detectados pueden personalizarse sin modificar el repositorio."
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          <Field
            label="Nombre"
            value={form.name}
            onChange={set("name")}
            required
          />
          <Field
            label="Carpeta"
            value={form.path}
            onChange={set("path")}
            required
          />
          <div className="two-columns">
            <Field
              label="Comando"
              value={form.command}
              onChange={set("command")}
              required
            />
            <Field
              label="URL"
              value={form.url}
              onChange={set("url")}
              required
            />
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
            Guardar
          </button>
        </footer>
      </form>
    </Modal>
  );
}
