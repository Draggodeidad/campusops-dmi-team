# W08 — revalidación posterior al merge de #58

Main realmente evaluado: fb11b69f3617466712bbd67d0ef49f0592d3a357.
Rama fix/w08-post-merge-evidence-issue-52. validation.json contiene 20 comandos
con exit 0, Node 22.22.0, npm 10.9.4, entorno, cwd, tiempos y fuente limpia.
Los dos índices oficiales referencian este main; no se reutilizan resultados
de otro SHA. Los 49 artefactos anteriores se preservan en
before-post-merge-capture.tar.gz con hashes en post-merge-archive.json.

final-report.md describe diagnóstico HEAD/padre, verificaciones, auditoría,
procedencia y congelación pendiente. Los .log legibles sólo normalizan blancos
finales; los .log.gz conservan stdout original verificable. La asistencia de
IA se declara y no se atribuye como ejecución personal de los integrantes.
individual.json no cambia; AC-04/AC-05 permanecen pendientes de corroboración.

El owner debe fusionar el nuevo PR mediante merge commit. El agente comprobará
el main definitivo antes de crear y publicar el tag anotado autorizado. No se
mueve ninguna referencia existente ni se publica si evidence-week-08 falla.
El archivo Classroom se genera fuera del checkout sólo después del tag remoto
válido. Ni tag ni archivo de entrega se han creado en esta fase.

No se modifica código, docs, pruebas, workflow, evaluador, dependencias ni
umbrales. audit-proposal.md es propuesta documental separada, sin aplicar.
