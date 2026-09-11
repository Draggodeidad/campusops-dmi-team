import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';

const incidents: readonly Incident[] = [
  {
    id: 'INC-001',
    title: 'Fuga de agua en laboratorio',
    description: 'Se observa una fuga debajo del lavabo; el área está señalizada.',
    category: 'water',
    status: 'open',
    locationLabel: 'Laboratorio B-204',
  },
  {
    id: 'INC-002',
    title: 'Proyector sin señal',
    description: 'El proyector enciende, pero no detecta la entrada HDMI del aula.',
    category: 'equipment',
    status: 'assigned',
    locationLabel: 'Aula C-112',
  },
  {
    id: 'INC-003',
    title: 'Punto de red intermitente',
    description: 'La conexión cableada pierde enlace varias veces durante la clase.',
    category: 'connectivity',
    status: 'in_progress',
    locationLabel: 'Biblioteca, planta alta',
  },
];

export class FakeIncidentRepository implements IncidentRepository {
  async findAll(): Promise<readonly Incident[]> {
    return incidents;
  }

  async findById(id: string): Promise<Incident | null> {
    return incidents.find((incident) => incident.id === id) ?? null;
  }
}
