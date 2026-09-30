export type RawLevel = {
  id: number;
  title: string;
  image?: string;
  rows: number;
  cols: number;
  map: string[][];
  start: [number, number];
  code: string;
  concept: string;
  learningObjective: string;
};

export const rawLevels = [
  {
    "id": 1,
    "title": "Level 01",
    "image": "resources/01.png",
    "rows": 1,
    "cols": 4,
    "map": [
      [
        "b",
        "b",
        "b",
        "b"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "right();\nright();\nright();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 2,
    "title": "Level 02",
    "image": "resources/02.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "p",
        "p",
        "b"
      ],
      [
        "p",
        "p",
        "b"
      ],
      [
        "b",
        "b",
        "b"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "up();\nleft();\ndown();\nright();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 3,
    "title": "Level 03",
    "image": "resources/03.png",
    "rows": 3,
    "cols": 6,
    "map": [
      [
        "b",
        "o",
        "b",
        "b",
        "b",
        "b"
      ],
      [
        "b",
        "p",
        "p",
        "p",
        "p",
        "b"
      ],
      [
        "b",
        "b",
        "b",
        "b",
        "p",
        "b"
      ]
    ],
    "start": [
      0,
      1
    ],
    "code": "down();\nright();\nright();\nright();\nright();\ndown();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 4,
    "title": "Level 04",
    "image": "resources/04.png",
    "rows": 3,
    "cols": 7,
    "map": [
      [
        "g",
        "g",
        "g",
        "g",
        "g",
        "p",
        "g"
      ],
      [
        "g",
        "p",
        "p",
        "p",
        "p",
        "p",
        "g"
      ],
      [
        "g",
        "p",
        "g",
        "g",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      2,
      1
    ],
    "code": "up();\nrepeat(3) {\n  right();\n}\nup();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 5,
    "title": "Level 05",
    "image": "resources/05.png",
    "rows": 6,
    "cols": 3,
    "map": [
      [
        "g",
        "g",
        "g"
      ],
      [
        "b",
        "b",
        "g"
      ],
      [
        "g",
        "b",
        "g"
      ],
      [
        "g",
        "b",
        "g"
      ],
      [
        "g",
        "b",
        "b"
      ],
      [
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      1,
      0
    ],
    "code": "right();\nrepeat(9) {\n  down();\n}\nright();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 6,
    "title": "Level 06",
    "image": "resources/06.png",
    "rows": 3,
    "cols": 5,
    "map": [
      [
        "g",
        "g",
        "g",
        "g",
        "p"
      ],
      [
        "g",
        "g",
        "g",
        "g",
        "g"
      ],
      [
        "p",
        "g",
        "g",
        "g",
        "p"
      ]
    ],
    "start": [
      2,
      4
    ],
    "code": "repeat(4) {\n  up();\n  left();\n}\ndown();",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 7,
    "title": "Level 07",
    "image": "resources/07.png",
    "rows": 6,
    "cols": 7,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      0,
      4
    ],
    "code": "repeat(3) {\n  down();\n  left();\n}\nrepeat(2) {\n  right();\n  down();\n}\nrepeat(2) {\n  up();\n  right();\n}",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 8,
    "title": "Level 08",
    "image": "resources/08.png",
    "rows": 4,
    "cols": 4,
    "map": [
      [
        "g",
        "g",
        "g",
        "g"
      ],
      [
        "g",
        "p",
        "g",
        "g"
      ],
      [
        "g",
        "g",
        "g",
        "g"
      ],
      [
        "g",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "repeat(4) {\n  up();\n}\nrepeat(4) {\n  right();\n}\nrepeat(4) {\n  down();\n}\nrepeat(4) {\n  left();\n}",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 9,
    "title": "Level 09",
    "image": "resources/09.png",
    "rows": 4,
    "cols": 4,
    "map": [
      [
        "p",
        "g",
        "g",
        "g"
      ],
      [
        "p",
        "g",
        "g",
        "g"
      ],
      [
        "p",
        "g",
        "g",
        "g"
      ],
      [
        "p",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      3,
      0
    ],
    "code": "repeat(4) {\n  repeat(4) {\n    right();\n  }\n  up();\n}",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 10,
    "title": "Level 10",
    "image": "resources/10.png",
    "rows": 6,
    "cols": 7,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      2,
      1
    ],
    "code": "repeat(3) {\n  repeat(4) {\n    right();\n  }\n  repeat(4) {\n    left();\n  }\n}",
    "concept": "Sequence and repeat loops",
    "learningObjective": "อ่านคำสั่งทีละบรรทัด, นับตำแหน่งบนกริด, เห็น pattern ที่ทำซ้ำ"
  },
  {
    "id": 11,
    "title": "Level 11",
    "image": "resources/11.png",
    "rows": 2,
    "cols": 2,
    "map": [
      [
        "n",
        "n"
      ],
      [
        "n",
        "o"
      ]
    ],
    "start": [
      0,
      1
    ],
    "code": "down();\nif (o) {\n  left();\n}\nup();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 12,
    "title": "Level 12",
    "image": "resources/12.png",
    "rows": 3,
    "cols": 4,
    "map": [
      [
        "n",
        "o",
        "n",
        "o"
      ],
      [
        "p",
        "n",
        "p",
        "n"
      ],
      [
        "n",
        "o",
        "n",
        "o"
      ]
    ],
    "start": [
      2,
      0
    ],
    "code": "right();\nif (o) {\n  up();\n}\nright();\nif (o) {\n  up();\n}\nright();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 13,
    "title": "Level 13",
    "image": "resources/13.png",
    "rows": 4,
    "cols": 6,
    "map": [
      [
        "n",
        "o",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "o",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "o",
        "n"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(4) {\n  if (o) {\n    down();\n  }\n  right();\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 14,
    "title": "Level 14",
    "image": "resources/14.png",
    "rows": 4,
    "cols": 6,
    "map": [
      [
        "n",
        "o",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "o",
        "o",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "o",
        "o",
        "o",
        "n",
        "n"
      ],
      [
        "n",
        "o",
        "o",
        "o",
        "o",
        "n"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(4) {\n  if (o) {\n    down();\n  }\n  right();\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 15,
    "title": "Level 15",
    "image": "resources/15.png",
    "rows": 5,
    "cols": 7,
    "map": [
      [
        "n",
        "o",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "o",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "o",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "p",
        "n"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(5) {\n  right();\n  if (o) {\n    down();\n    down();\n  }\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 16,
    "title": "Level 16",
    "image": "resources/16.png",
    "rows": 2,
    "cols": 5,
    "map": [
      [
        "o",
        "p",
        "o",
        "o",
        "o"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      1,
      4
    ],
    "code": "repeat(5) {\n  up();\n  if (o) {\n    left();\n  }\n}\ndown();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 17,
    "title": "Level 17",
    "image": "resources/17.png",
    "rows": 2,
    "cols": 5,
    "map": [
      [
        "o",
        "n",
        "o",
        "n",
        "o"
      ],
      [
        "n",
        "o",
        "n",
        "o",
        "n"
      ]
    ],
    "start": [
      1,
      2
    ],
    "code": "repeat(22) {\n  if (o) {\n    right();\n  }\n}\nup();\nleft();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 18,
    "title": "Level 18",
    "image": "resources/18.png",
    "rows": 2,
    "cols": 6,
    "map": [
      [
        "n",
        "n",
        "n",
        "o",
        "o",
        "o"
      ],
      [
        "o",
        "o",
        "o",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      1,
      0
    ],
    "code": "repeat(33) {\n  if (o) {\n    right();\n  }\n}\nup();\nleft();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 19,
    "title": "Level 19",
    "image": "resources/19.png",
    "rows": 5,
    "cols": 2,
    "map": [
      [
        "g",
        "o"
      ],
      [
        "g",
        "o"
      ],
      [
        "n",
        "n"
      ],
      [
        "g",
        "o"
      ],
      [
        "g",
        "o"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(5) {\n  if (o) {\n    repeat(4) {\n      left();\n    }\n  }\n  down();\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 20,
    "title": "Level 20",
    "image": "resources/20.png",
    "rows": 5,
    "cols": 4,
    "map": [
      [
        "g",
        "g",
        "g",
        "n"
      ],
      [
        "g",
        "g",
        "g",
        "o"
      ],
      [
        "g",
        "g",
        "g",
        "n"
      ],
      [
        "g",
        "g",
        "g",
        "o"
      ],
      [
        "g",
        "g",
        "g",
        "n"
      ]
    ],
    "start": [
      0,
      3
    ],
    "code": "repeat(5) {\n  right();\n  if (o) {\n    down();\n    down();\n  }\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 21,
    "title": "Level 21",
    "image": "resources/21.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "o",
        "b",
        "o"
      ],
      [
        "b",
        "o",
        "b"
      ],
      [
        "o",
        "b",
        "o"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(5) {\n  up();\n  if (o) {\n    left();\n  }\n  if (g) {\n    right();\n  }\n  down();\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 22,
    "title": "Level 22",
    "image": "resources/22.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "b",
        "o",
        "b"
      ],
      [
        "o",
        "b",
        "o"
      ],
      [
        "b",
        "o",
        "b"
      ]
    ],
    "start": [
      2,
      2
    ],
    "code": "up();\nif (o) {\n  left();\n  left();\n} else {\n  down();\n  down();\n}\nright();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 23,
    "title": "Level 23",
    "image": "resources/23.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "g",
        "o",
        "g"
      ],
      [
        "o",
        "g",
        "o"
      ],
      [
        "g",
        "o",
        "g"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "if (g) {\n  left();\n  down();\n} else {\n  up();\n}\nif (o) {\n  down();\n  down();\n} else {\n  right();\n}\nup();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 24,
    "title": "Level 24",
    "image": "resources/24.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "g",
        "p",
        "g"
      ],
      [
        "p",
        "b",
        "p"
      ],
      [
        "g",
        "p",
        "g"
      ]
    ],
    "start": [
      1,
      0
    ],
    "code": "right();\nif (g) {\n  left();\n} else if (b) {\n  up();\n} else {\n  right();\n}\ndown();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 25,
    "title": "Level 25",
    "image": "resources/25.png",
    "rows": 3,
    "cols": 3,
    "map": [
      [
        "p",
        "b",
        "p"
      ],
      [
        "b",
        "g",
        "b"
      ],
      [
        "p",
        "b",
        "p"
      ]
    ],
    "start": [
      1,
      0
    ],
    "code": "right();\nif (g) {\n  down();\n} else if (b) {\n  right();\n} else {\n  left();\n}\nup();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 26,
    "title": "Level 26",
    "image": "resources/26.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "o"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "g"
      ],
      [
        "n",
        "o",
        "p",
        "g",
        "n"
      ],
      [
        "o",
        "g",
        "n",
        "n",
        "n"
      ],
      [
        "g",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      0,
      4
    ],
    "code": "repeat(8) {\n  if (o) {\n    down();\n  } else {\n    left();\n  }\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 27,
    "title": "Level 27",
    "image": "resources/27.png",
    "rows": 5,
    "cols": 4,
    "map": [
      [
        "o",
        "o",
        "o",
        "n"
      ],
      [
        "n",
        "b",
        "b",
        "b"
      ],
      [
        "o",
        "o",
        "o",
        "n"
      ],
      [
        "n",
        "b",
        "b",
        "b"
      ],
      [
        "o",
        "o",
        "o",
        "n"
      ]
    ],
    "start": [
      4,
      0
    ],
    "code": "repeat(19) {\n  if (o) {\n    right();\n  } else if (b) {\n    left();\n  } else {\n    up();\n  }\n}",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 28,
    "title": "Level 28",
    "image": "resources/28.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "n",
        "n",
        "p",
        "n",
        "n"
      ],
      [
        "n",
        "p",
        "p",
        "p",
        "n"
      ],
      [
        "g",
        "o",
        "o",
        "o",
        "b"
      ],
      [
        "g",
        "g",
        "o",
        "b",
        "b"
      ],
      [
        "g",
        "n",
        "n",
        "n",
        "b"
      ]
    ],
    "start": [
      4,
      1
    ],
    "code": "repeat(5) {\n  if (o) {\n    left();\n  } else {\n    right();\n  }\n}\nup();",
    "concept": "Conditionals",
    "learningObjective": "ใช้สีของช่องปัจจุบันเป็นเงื่อนไข if, else, else-if เพื่อเลือกทางเดิน"
  },
  {
    "id": 29,
    "title": "Level 29",
    "image": "resources/29.png",
    "rows": 3,
    "cols": 7,
    "map": [
      [
        "v",
        "v",
        "v",
        "v",
        "y",
        "v",
        "v"
      ],
      [
        "n",
        "n",
        "n",
        "y",
        "p",
        "y",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "y",
        "n",
        "n"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "while (v) {\n  right();\n}\ndown();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 30,
    "title": "Level 30",
    "image": "resources/30.png",
    "rows": 5,
    "cols": 9,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "y",
        "p",
        "v",
        "p",
        "n"
      ],
      [
        "n",
        "n",
        "p",
        "y",
        "v",
        "y",
        "p",
        "n",
        "n"
      ],
      [
        "n",
        "p",
        "v",
        "p",
        "y",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      1,
      6
    ],
    "code": "while (v) {\n  left();\n  down();\n  left();\n}\nup();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 31,
    "title": "Level 31",
    "image": "resources/31.png",
    "rows": 4,
    "cols": 5,
    "map": [
      [
        "g",
        "g",
        "v",
        "g",
        "p"
      ],
      [
        "v",
        "g",
        "g",
        "g",
        "g"
      ],
      [
        "g",
        "g",
        "g",
        "v",
        "g"
      ],
      [
        "g",
        "v",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      3,
      0
    ],
    "code": "while (g) {\n  up();\n  if (v) {\n    right();\n  }\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 32,
    "title": "Level 32",
    "image": "resources/32.png",
    "rows": 5,
    "cols": 4,
    "map": [
      [
        "v",
        "g",
        "v",
        "g"
      ],
      [
        "v",
        "g",
        "v",
        "g"
      ],
      [
        "g",
        "v",
        "g",
        "v"
      ],
      [
        "g",
        "v",
        "g",
        "v"
      ],
      [
        "v",
        "g",
        "p",
        "g"
      ]
    ],
    "start": [
      0,
      3
    ],
    "code": "while (g) {\n  left();\n  while (v) {\n    down();\n  }\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 33,
    "title": "Level 33",
    "image": "resources/33.png",
    "rows": 4,
    "cols": 5,
    "map": [
      [
        "n",
        "v",
        "n",
        "v",
        "n"
      ],
      [
        "o",
        "v",
        "o",
        "v",
        "o"
      ],
      [
        "o",
        "v",
        "o",
        "v",
        "o"
      ],
      [
        "o",
        "n",
        "o",
        "n",
        "o"
      ]
    ],
    "start": [
      3,
      4
    ],
    "code": "repeat(5) {\n  while (o) {\n    up();\n  }\n  while (v) {\n    down();\n  }\n  left();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 34,
    "title": "Level 34",
    "image": "resources/34.png",
    "rows": 6,
    "cols": 6,
    "map": [
      [
        "g",
        "n",
        "n",
        "n",
        "n",
        "g"
      ],
      [
        "n",
        "v",
        "p",
        "v",
        "p",
        "n"
      ],
      [
        "n",
        "p",
        "n",
        "n",
        "v",
        "n"
      ],
      [
        "n",
        "v",
        "n",
        "n",
        "p",
        "n"
      ],
      [
        "n",
        "p",
        "v",
        "p",
        "v",
        "n"
      ],
      [
        "g",
        "n",
        "n",
        "n",
        "n",
        "g"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "while (v) {\n  repeat(3) {\n    down();\n  }\n  right();\n}\nup();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 35,
    "title": "Level 35",
    "image": "resources/35.png",
    "rows": 2,
    "cols": 2,
    "map": [
      [
        "n",
        "n"
      ],
      [
        "p",
        "n"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "left();\nif (!p) {\n  up();\n}\nright();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 36,
    "title": "Level 36",
    "image": "resources/36.png",
    "rows": 3,
    "cols": 4,
    "map": [
      [
        "o",
        "n",
        "o",
        "n"
      ],
      [
        "n",
        "p",
        "n",
        "p"
      ],
      [
        "o",
        "n",
        "o",
        "n"
      ]
    ],
    "start": [
      2,
      3
    ],
    "code": "left();\nif (!o) {\n  up();\n}\nleft();\nif (!o) {\n  up();\n}\nleft();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 37,
    "title": "Level 37",
    "image": "resources/37.png",
    "rows": 4,
    "cols": 6,
    "map": [
      [
        "n",
        "p",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "p",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "p",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "p",
        "n"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(3) {\n  if (!p) {\n    right();\n  }\n  down();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 38,
    "title": "Level 38",
    "image": "resources/38.png",
    "rows": 2,
    "cols": 6,
    "map": [
      [
        "p",
        "p",
        "p",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "p",
        "p",
        "p"
      ]
    ],
    "start": [
      0,
      5
    ],
    "code": "repeat(33) {\n  if (!p) {\n    left();\n  }\n}\ndown();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 39,
    "title": "Level 39",
    "image": "resources/39.png",
    "rows": 2,
    "cols": 6,
    "map": [
      [
        "n",
        "n",
        "n",
        "v",
        "v",
        "v"
      ],
      [
        "v",
        "v",
        "v",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      1,
      5
    ],
    "code": "while (!v) {\n  left();\n}\nup();",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 40,
    "title": "Level 40",
    "image": "resources/40.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "v",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "o",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "o",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "o"
      ]
    ],
    "start": [
      4,
      4
    ],
    "code": "while (!v) {\n  up();\n  left();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 41,
    "title": "Level 41",
    "image": "resources/41.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "o",
        "n",
        "p",
        "n",
        "o"
      ],
      [
        "n",
        "o",
        "p",
        "o",
        "n"
      ],
      [
        "p",
        "p",
        "o",
        "p",
        "p"
      ],
      [
        "n",
        "o",
        "p",
        "o",
        "n"
      ],
      [
        "o",
        "n",
        "p",
        "n",
        "o"
      ]
    ],
    "start": [
      0,
      4
    ],
    "code": "repeat(5) {\n  left();\n  left();\n  if (!o) {\n    right();\n    right();\n  }\n  down();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 42,
    "title": "Level 42",
    "image": "resources/42.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "n",
        "n",
        "n",
        "g",
        "o"
      ],
      [
        "n",
        "n",
        "g",
        "o",
        "n"
      ],
      [
        "n",
        "n",
        "p",
        "n",
        "n"
      ],
      [
        "n",
        "g",
        "o",
        "n",
        "n"
      ],
      [
        "g",
        "o",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      0,
      4
    ],
    "code": "repeat(8) {\n  if (!o) {\n    down();\n  } else {\n    left();\n  }\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 43,
    "title": "Level 43",
    "image": "resources/43.png",
    "rows": 9,
    "cols": 6,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "p",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "p",
        "p",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "p",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "n",
        "n"
      ],
      [
        "y",
        "y",
        "o",
        "o",
        "o",
        "v"
      ],
      [
        "y",
        "y",
        "g",
        "v",
        "v",
        "v"
      ],
      [
        "p",
        "p",
        "g",
        "g",
        "y",
        "y"
      ],
      [
        "n",
        "p",
        "p",
        "g",
        "y",
        "y"
      ]
    ],
    "start": [
      1,
      2
    ],
    "code": "while (!v) {\n  if (p) {\n    left();\n  } else if (g) {\n    up();\n  } else if (o) {\n    right();\n  } else if (y) {\n    down();\n    right();\n  } else {\n    down();\n  }\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 44,
    "title": "Level 44",
    "image": "resources/44.png",
    "rows": 4,
    "cols": 5,
    "map": [
      [
        "n",
        "v",
        "n",
        "v",
        "p"
      ],
      [
        "o",
        "v",
        "o",
        "v",
        "o"
      ],
      [
        "o",
        "v",
        "o",
        "v",
        "o"
      ],
      [
        "o",
        "n",
        "o",
        "n",
        "o"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "while (!v) {\n  right();\n  while (o) {\n    up();\n  }\n  while (v) {\n    down();\n  }\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 45,
    "title": "Level 45",
    "image": "resources/45.png",
    "rows": 5,
    "cols": 5,
    "map": [
      [
        "p",
        "g",
        "p",
        "o",
        "p"
      ],
      [
        "p",
        "o",
        "p",
        "b",
        "p"
      ],
      [
        "p",
        "b",
        "p",
        "y",
        "p"
      ],
      [
        "p",
        "y",
        "p",
        "v",
        "p"
      ],
      [
        "p",
        "v",
        "p",
        "g",
        "p"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "repeat(4) {\n  repeat(4) {\n    if (!p) {\n      up();\n    } else {\n      down();\n    }\n  }\n  right();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 46,
    "title": "Level 46",
    "image": "resources/46.png",
    "rows": 6,
    "cols": 6,
    "map": [
      [
        "n",
        "n",
        "n",
        "o",
        "g",
        "p"
      ],
      [
        "o",
        "g",
        "g",
        "g",
        "g",
        "p"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "o",
        "p"
      ],
      [
        "n",
        "o",
        "g",
        "g",
        "g",
        "p"
      ],
      [
        "n",
        "n",
        "n",
        "o",
        "g",
        "p"
      ],
      [
        "n",
        "n",
        "o",
        "g",
        "g",
        "p"
      ]
    ],
    "start": [
      5,
      5
    ],
    "code": "repeat(6) {\n  while (!o) {\n    left();\n  }\n  while (!p) {\n    right();\n  }\n  up();\n}",
    "concept": "While loops and negation",
    "learningObjective": "เข้าใจ loop แบบหยุดเมื่อเงื่อนไขเปลี่ยน, ใช้ ! เพื่อคิดกลับด้าน, trace loop ซ้อน"
  },
  {
    "id": 47,
    "title": "Level 47",
    "image": "resources/47.png",
    "rows": 1,
    "cols": 4,
    "map": [
      [
        "v",
        "v",
        "v",
        "v"
      ]
    ],
    "start": [
      0,
      0
    ],
    "code": "toTheRight();\n\nfunction toTheRight() {\n  right();\n  right();\n  right();\n}",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 48,
    "title": "Level 48",
    "image": "resources/48.png",
    "rows": 1,
    "cols": 4,
    "map": [
      [
        "p",
        "p",
        "p",
        "p"
      ]
    ],
    "start": [
      0,
      1
    ],
    "code": "left();\ntoTheRight();\n\nfunction toTheRight() {\n  right();\n  right();\n  right();\n}",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 49,
    "title": "Level 49",
    "image": "resources/49.png",
    "rows": 1,
    "cols": 4,
    "map": [
      [
        "g",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      0,
      1
    ],
    "code": "function toTheRight() {\n  right();\n  right();\n  right();\n}\n\nleft();\ntoTheRight();",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 50,
    "title": "Level 50",
    "image": "resources/50.png",
    "rows": 4,
    "cols": 4,
    "map": [
      [
        "n",
        "b",
        "b",
        "b"
      ],
      [
        "p",
        "v",
        "v",
        "b"
      ],
      [
        "p",
        "v",
        "v",
        "b"
      ],
      [
        "p",
        "p",
        "p",
        "n"
      ]
    ],
    "start": [
      2,
      2
    ],
    "code": "left();\nsquare();\nright();\nsquare();\n\nfunction square() {\n  up();\n  left();\n  down();\n  right();\n}",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 51,
    "title": "Level 51",
    "image": "resources/51.png",
    "rows": 6,
    "cols": 7,
    "map": [
      [
        "b",
        "b",
        "b",
        "b",
        "b",
        "b",
        "b"
      ],
      [
        "b",
        "y",
        "b",
        "b",
        "b",
        "b",
        "b"
      ],
      [
        "b",
        "b",
        "b",
        "b",
        "b",
        "b",
        "b"
      ],
      [
        "b",
        "b",
        "b",
        "b",
        "b",
        "b",
        "b"
      ],
      [
        "g",
        "g",
        "g",
        "b",
        "g",
        "g",
        "g"
      ],
      [
        "g",
        "g",
        "g",
        "b",
        "g",
        "g",
        "g"
      ]
    ],
    "start": [
      3,
      0
    ],
    "code": "function jump() {\n  up();\n  right();\n  right();\n  down();\n}\n\nfunction run() {\n  right();\n  right();\n}\n\nrun();\njump();\nrun();",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 52,
    "title": "Level 52",
    "image": "resources/52.png",
    "rows": 6,
    "cols": 7,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "p"
      ],
      [
        "p",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      2,
      5
    ],
    "code": "function ping() {\n  repeat(4) {\n    left();\n  }\n}\n\nfunction pong() {\n  repeat(4) {\n    right();\n  }\n}\n\nrepeat(3) {\n  ping();\n  pong();\n}",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 53,
    "title": "Level 53",
    "image": "resources/53.png",
    "rows": 3,
    "cols": 5,
    "map": [
      [
        "v",
        "y",
        "v",
        "y",
        "v"
      ],
      [
        "y",
        "v",
        "y",
        "v",
        "y"
      ],
      [
        "v",
        "y",
        "v",
        "y",
        "v"
      ]
    ],
    "start": [
      1,
      1
    ],
    "code": "function shake() {\n  left();\n  right();\n  left();\n  right();\n}\n\nfunction dance() {\n  shake();\n  right();\n}\n\ndance();\ndance();\ndance();",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 54,
    "title": "Level 54",
    "image": "resources/54.png",
    "rows": 3,
    "cols": 5,
    "map": [
      [
        "v",
        "y",
        "v",
        "y",
        "v"
      ],
      [
        "y",
        "v",
        "p",
        "v",
        "y"
      ],
      [
        "v",
        "y",
        "v",
        "y",
        "v"
      ]
    ],
    "start": [
      1,
      3
    ],
    "code": "function shake() {\n  if (p) {\n    left();\n  }\n  right();\n  left();\n  right();\n  if (y) {\n    left();\n  }\n}\n\nfunction choreography() {\n  shake();\n  left();\n  shake();\n  right();\n}\n\nchoreography();\nchoreography();\nchoreography();",
    "concept": "Functions and decomposition",
    "learningObjective": "มองชุดคำสั่งซ้ำเป็นฟังก์ชัน, อ่านลำดับ call และ reuse behavior"
  },
  {
    "id": 55,
    "title": "Level 55",
    "image": "resources/55.png",
    "rows": 7,
    "cols": 3,
    "map": [
      [
        "n",
        "n",
        "k"
      ],
      [
        "n",
        "n",
        "p"
      ],
      [
        "n",
        "n",
        "k"
      ],
      [
        "n",
        "n",
        "p"
      ],
      [
        "k",
        "p",
        "g"
      ],
      [
        "p",
        "n",
        "p"
      ],
      [
        "k",
        "n",
        "k"
      ]
    ],
    "start": [
      0,
      2
    ],
    "code": "function road() {\n  down();\n  down();\n  if (g) {\n    bypass();\n  } else {\n    road();\n  }\n}\n\nfunction bypass() {\n  left();\n  left();\n  down();\n  down();\n}\n\nroad();",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  },
  {
    "id": 56,
    "title": "Level 56",
    "image": "resources/56.png",
    "rows": 5,
    "cols": 9,
    "map": [
      [
        "g",
        "b",
        "k",
        "b",
        "p",
        "b",
        "k",
        "b",
        "k"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "b",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "g",
        "b",
        "p",
        "b",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "b",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "g",
        "b",
        "k",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      0,
      8
    ],
    "code": "function road() {\n  left();\n  left();\n  if (p) {\n    bypass();\n  }\n  if (k) {\n    road();\n  }\n}\n\nfunction bypass() {\n  down();\n  down();\n}\n\nroad();",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  },
  {
    "id": 57,
    "title": "Level 57",
    "image": "resources/57.png",
    "rows": 5,
    "cols": 7,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "v",
        "y",
        "v",
        "y",
        "v",
        "n"
      ],
      [
        "n",
        "y",
        "v",
        "y",
        "v",
        "y",
        "n"
      ],
      [
        "n",
        "v",
        "y",
        "v",
        "y",
        "v",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      2,
      2
    ],
    "code": "function shake() {\n  left();\n  right();\n  left();\n  right();\n}\n\nfunction dance() {\n  shake();\n  right();\n}\n\nfunction choreography() {\n  if (v) {\n    right();\n    dance();\n  } else {\n    left();\n  }\n  left();\n  left();\n}\n\nrepeat(3) {\n  choreography();\n}",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  },
  {
    "id": 58,
    "title": "Level 58",
    "image": "resources/58.png",
    "rows": 9,
    "cols": 11,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "n",
        "n",
        "n",
        "k",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "k",
        "n",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "k",
        "p",
        "k",
        "p",
        "k",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "n",
        "k",
        "n",
        "k",
        "n",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "k",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "k",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      4,
      8
    ],
    "code": "function choice() {\n  if (k) {\n    fromBelow();\n  }\n  if (p) {\n    fromAbove();\n  }\n}\n\nfunction fromAbove() {\n  up();\n  left();\n  left();\n  down();\n  right();\n  choice();\n}\n\nfunction fromBelow() {\n  down();\n  left();\n  left();\n  up();\n  right();\n  choice();\n}\n\nchoice();",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  },
  {
    "id": 59,
    "title": "Level 59",
    "image": "resources/59.png",
    "rows": 10,
    "cols": 13,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "g",
        "g",
        "n",
        "n",
        "n",
        "k",
        "n",
        "n",
        "n",
        "g",
        "g",
        "n"
      ],
      [
        "n",
        "g",
        "g",
        "g",
        "n",
        "k",
        "k",
        "k",
        "n",
        "g",
        "g",
        "g",
        "n"
      ],
      [
        "n",
        "n",
        "g",
        "g",
        "g",
        "k",
        "k",
        "k",
        "g",
        "g",
        "g",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "k",
        "k",
        "y",
        "k",
        "y",
        "k",
        "k",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "k",
        "n",
        "k",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "k",
        "n",
        "k",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      5,
      7
    ],
    "code": "function choice() {\n  if (y) {\n    while (!g) {\n      left();\n      down();\n    }\n    choice();\n  } else {\n    while (!y) {\n      down();\n      right();\n    }\n  }\n  right();\n}\n\nchoice();",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  },
  {
    "id": 60,
    "title": "Level 60",
    "image": "resources/60.png",
    "rows": 12,
    "cols": 12,
    "map": [
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "k",
        "k",
        "v",
        "v",
        "v",
        "v",
        "v",
        "k",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "k",
        "v",
        "y",
        "y",
        "k",
        "y",
        "y",
        "v",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "k",
        "y",
        "y",
        "y",
        "k",
        "y",
        "y",
        "y",
        "k",
        "n",
        "n"
      ],
      [
        "k",
        "n",
        "k",
        "y",
        "y",
        "k",
        "k",
        "k",
        "y",
        "y",
        "k",
        "n"
      ],
      [
        "n",
        "k",
        "k",
        "k",
        "k",
        "p",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "k",
        "k",
        "k",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "k",
        "n",
        "k",
        "n",
        "k",
        "n",
        "n",
        "n",
        "n"
      ],
      [
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n",
        "n"
      ]
    ],
    "start": [
      7,
      5
    ],
    "code": "function fall() {\n  while (!p) {\n    down();\n  }\n}\n\nfunction eye() {\n  repeat(2) {\n    right();\n    if (k) {\n      fall();\n    }\n  }\n}\n\nwhile (!v) {\n  up();\n}\n\nrepeat(3) {\n  left();\n  if (v) {\n    down();\n    right();\n    eye();\n  }\n}",
    "concept": "Recursion and advanced control flow",
    "learningObjective": "ตามการเรียกฟังก์ชันตัวเอง, decision tree, call stack และ termination"
  }
] satisfies RawLevel[];
