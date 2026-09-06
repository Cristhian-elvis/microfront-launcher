import React, { useState } from "react";
import { Modal } from "./Modal.jsx";

export function BrowserOpenModal({ prompt, onClose, onOpen }) {
  const [remember, setRemember] = useState(false);
  return (
    <Modal
      title="Navegador ya abierto"
      subtitle={`Ya existe una ventana de ${prompt.browser}${prompt.insecure ? " con esta configuración de desarrollo" : ""}.`}
      onClose={onClose}
      width={520}
    >
      <div className="modal-body browser-choice">
        <p>¿Cómo deseas abrir esta shell?</p>
        <label>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />{" "}
          Marcar como preferencia
        </label>
      </div>
      <footer className="modal-actions">
        <button className="button ghost" onClick={onClose}>
          Ahora no
        </button>
        <button
          className="button secondary"
          onClick={() => onOpen("tab", remember)}
        >
          Nueva pestaña
        </button>
        <button
          className="button primary"
          onClick={() => onOpen("window", remember)}
        >
          Nueva ventana
        </button>
      </footer>
    </Modal>
  );
}
