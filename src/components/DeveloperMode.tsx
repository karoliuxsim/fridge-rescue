"use client";
import { useSyncExternalStore } from "react";
import { clearDiagnostics, getDiagnostics, getServerDiagnostics, setDiagnosticsEnabled, subscribeDiagnostics } from "@/lib/browser-api-diagnostics";

export default function DeveloperMode() {
  const { enabled, entries } = useSyncExternalStore(subscribeDiagnostics, getDiagnostics, getServerDiagnostics);
  return <aside className="shell developer-mode" aria-label="Developer Mode">
    <label className="developer-switch"><input type="checkbox" role="switch" checked={enabled}
      onChange={event => setDiagnosticsEnabled(event.target.checked)} />Developer Mode</label>
    {enabled && <section className="developer-panel" aria-labelledby="developer-title">
      <div className="developer-heading"><h2 id="developer-title">Naršyklės API užklausos</h2>
        <button type="button" onClick={clearDiagnostics}>Išvalyti</button></div>
      <p className="hint">Rodomi mūsų endpoint HTTP statusai ir laukimas iki atsakymo antraščių, ne vidinių paslaugų statusai ar JSON apdorojimo laikas. Serverio komponentų ir autentifikacijos vidinės užklausos čia nerodomos. Iki 30 paskutinių įrašų.</p>
      {!entries.length && <p role="status">Užklausų dar nėra.</p>}
      <div className="developer-table-scroll" tabIndex={0} aria-label="API diagnostikos lentelė">
        <table><thead><tr><th scope="col">API sistema / operacija</th><th scope="col">Endpoint</th><th scope="col">HTTP metodas</th><th scope="col">HTTP statusas</th><th scope="col">Sėkmė</th><th scope="col">Trukmė</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.id}>
            <td>{entry.system}</td><td><code>{entry.endpoint}</code></td><td>{entry.method}</td>
            <td>{entry.status ?? `Negautas (${entry.outcome === "aborted" ? "atšaukta" : "tinklo klaida"})`}</td>
            <td>{entry.success ? "Taip" : "Ne"}</td><td>{entry.durationMs} ms</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
  </aside>;
}
