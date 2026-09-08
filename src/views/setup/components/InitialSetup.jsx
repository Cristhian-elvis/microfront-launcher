import { useState } from "react";
import Button from "@mui/material/Button";
import { api } from "../../../lib/api.js";
import { Icon } from "../../../shared/components/Icon.jsx";
import { Field } from "../../../shared/components/Modal.jsx";

export function InitialSetup({ config, onCompleted }) {
  const [form, setForm] = useState(JSON.parse(JSON.stringify(config)));
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState("");
  const update = (section, key) => (event) =>
    setForm({
      ...form,
      [section]: { ...form[section], [key]: event.target.value },
    });
  const selectDirectory = async (target) => {
    setError("");
    setSelecting(target);
    try {
      const { path } = await api("/api/dialogs/select-directory", {
        method: "POST",
        body: JSON.stringify({ target }),
      });
      if (!path) return;
      if (target === "mova")
        setForm({ ...form, mova: { ...form.mova, sourcePath: path } });
      else setForm({ ...form, rootPath: path });
    } catch (exception) {
      setError(exception.message);
    } finally {
      setSelecting("");
    }
  };
  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api("/api/config", { method: "PUT", body: JSON.stringify(form) });
      await onCompleted();
    } catch (exception) {
      setError(exception.message);
    }
  };

  return (
    <main className="init-page">
      <section className="init-card">
        <div className="init-icon">
          <Icon name="settings" size={26} />
        </div>
        <p className="eyebrow">PRIMER INICIO</p>
        <h1>Configura tu entorno local</h1>
        <p>
          Estos datos se guardarán solo en este equipo, dentro de{" "}
          <code>data/config.json</code>.
        </p>
        <form onSubmit={save}>
          <div className="init-form">
            <div className="init-path-field">
              <Field
                label="Ruta raíz de tus shells"
                value={form.rootPath}
                onChange={(event) =>
                  setForm({ ...form, rootPath: event.target.value })
                }
                placeholder="Ej.: D:\\proyectos"
                required
                hint="Carpeta que contiene los proyectos de shell; elige la carpeta padre común."
              />
              <Button
                className="init-directory-button"
                type="button"
                variant="outlined"
                disabled={Boolean(selecting)}
                onClick={() => selectDirectory("shells")}
                startIcon={
                  selecting === "shells" ? (
                    <span className="trace-spinner" />
                  ) : (
                    <Icon name="folder" size={16} />
                  )
                }
              >
                {selecting === "shells" ? "Abriendo…" : "Seleccionar carpeta"}
              </Button>
            </div>
            <div className="init-path-field">
              <Field
                label="Ruta del repositorio MOVA UI Components"
                value={form.mova.sourcePath}
                onChange={update("mova", "sourcePath")}
                placeholder="Ej.: D:\\repos\\mova3_lib_ui_components"
                required
                hint="Carpeta local del repositorio MOVA, la que contiene su carpeta .git."
              />
              <Button
                className="init-directory-button"
                type="button"
                variant="outlined"
                disabled={Boolean(selecting)}
                onClick={() => selectDirectory("mova")}
                startIcon={
                  selecting === "mova" ? (
                    <span className="trace-spinner" />
                  ) : (
                    <Icon name="folder" size={16} />
                  )
                }
              >
                {selecting === "mova" ? "Abriendo…" : "Seleccionar carpeta"}
              </Button>
            </div>
            <Field
              label="Puerto local"
              type="number"
              min="1"
              max="65535"
              value={form.shellDefaults.serverPort}
              onChange={update("shellDefaults", "serverPort")}
              required
              hint="Se usará para la shell y MOVA Components."
            />
          </div>
          {selecting && (
            <p className="init-selector-status">
              <span className="trace-spinner" />
              Abriendo el selector de carpetas de Windows…
            </p>
          )}
          {error && (
            <div className="form-error">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}
          <footer className="init-actions">
            <Button
              className="init-submit-button"
              type="submit"
              variant="contained"
              startIcon={<Icon name="check" />}
            >
              Guardar y continuar
            </Button>
          </footer>
        </form>
      </section>
    </main>
  );
}
