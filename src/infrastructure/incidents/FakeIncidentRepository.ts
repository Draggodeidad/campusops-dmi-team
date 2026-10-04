import type { Incident } from '../../domain/incidents/Incident';
import type { CreateIncidentData, IncidentRepository } from '../../domain/incidents/IncidentRepository';

export class FakeIncidentRepository implements IncidentRepository {
  private readonly items: Incident[] = [
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

  async findAll(): Promise<readonly Incident[]> {
    return [...this.items];
  }

  async findById(id: string): Promise<Incident | null> {
    return this.items.find((incident) => incident.id === id) ?? null;
  }

  async create(input: CreateIncidentData): Promise<Incident> {
    const created: Incident = {
      id: `INC-00${this.items.length + 1}`,
      title:
        input.description.length > 40
          ? `${input.description.slice(0, 37).trim()}...`
          : input.description,
      description: input.description,
      category: input.category,
      status: 'open',
      locationLabel: input.locationLabel,
    };
    this.items.push(created);
    return created;
  }
}
