export const examples = {
  workshops: {
    title: "Inscrições em oficinas",
    description:
      "Seis registros sintéticos: três aceitos, três rejeitados. Uma fórmula é neutralizada na exportação.",
    request: {
      delimiter: ",",
      columns: [
        { name: "id", type: "integer", min: 1, unique: true },
        { name: "name", type: "text" },
        { name: "email", type: "email", case: "lower", unique: true },
        { name: "date", type: "date" },
        { name: "seats", type: "integer", min: 1, max: 5 },
      ],
      csv: 'id,name,email,date,seats\n1,  Ana Exemplo  ,ANA@example.test,2026-11-04,2\n2,Bruno Exemplo,bruno@example.test,2026-02-30,1\n1,Outro Exemplo,outro@example.test,2026-11-05,1\n3,Carla Exemplo,carla@example.test,2026-11-06,0\n4,=1+1,formula@example.test,2026-11-07,1\n5,"Davi, Exemplo",davi@example.test,2026-11-08,3',
    },
  },
  library: {
    title: "Catálogo de biblioteca",
    description:
      "Ponto e vírgula, enum, normalização e rejeição de categoria desconhecida.",
    request: {
      delimiter: ";",
      columns: [
        { name: "code", type: "text", case: "upper", unique: true },
        { name: "title", type: "text" },
        { name: "year", type: "integer", min: 1450, max: 2030 },
        {
          name: "category",
          type: "enum",
          case: "lower",
          values: ["ficcao", "tecnico", "historia"],
        },
      ],
      csv: "code;title;year;category\nliv-01;Horizontes inventados;2022;FICCAO\nliv-02;Algoritmos de exemplo;2024;tecnico\nliv-03;Categoria incorreta;2020;outra",
    },
  },
};
