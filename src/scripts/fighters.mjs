// Metadados extraidos de AnimData.xml, PMDCollab/SpriteCollab.
// PNGs: os frames ficam em colunas e as direcoes em linhas.
// Na convencao PMD: esquerda = linha 2, direita = linha 6.
export const FIGHTERS = [
  {
    id: 'lucario',
    number: '0448',
    form: '0001',
    name: 'Mega Lucario',
    shortName: 'LUCARIO',
    kicker: 'AURA',
    color: '#65e3f8',
    darkColor: '#1c9dbc',
    damage: [12, 18],
    speed: 91,
    fireDelay: 1.08,
    sprites: {
      Idle:   { width: 32, height: 48, durations: [40,2,2,2,2,2,2,2,2,12] },
      Walk:   { width: 32, height: 48, durations: [8,10,8,10] },
      Attack: { width: 64, height: 80, durations: [2,2,2,2,1,1,1,1,2,2,2,2,2] },
      Hurt:   { width: 40, height: 56, durations: [2,8] }
    }
  },
  {
    id: 'gengar',
    number: '0094',
    form: '0001',
    name: 'Mega Gengar',
    shortName: 'GENGAR',
    kicker: 'SOMBRA',
    color: '#df89ff',
    darkColor: '#a14adb',
    damage: [12, 18],
    speed: 91,
    fireDelay: 1.08,
    sprites: {
      Idle:   { width: 40, height: 40, durations: [40,4,3,3,3,3,3,4] },
      Walk:   { width: 40, height: 40, durations: [8,10,8,10] },
      Attack: { width: 80, height: 80, durations: [4,2,4,1,1,1,2,2,2,2,4] },
      Hurt:   { width: 48, height: 48, durations: [2,8] }
    }
  }
];

export const spriteFile = (fighter, animation) =>
  `${fighter.number}/${fighter.form}/${animation}-Anim.png`;

export const originalSpriteUrl = (fighter, animation) =>
  `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${spriteFile(fighter, animation)}`;
