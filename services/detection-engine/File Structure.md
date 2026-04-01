services/detection-engine/
├── app/
│   ├── main.py       ← 5-layer pipeline orchestrator
│   ├── schemas.py    ← Request validation
│   ├── rules.py      ← 11 attack categories
│   ├── classifier.py ← Confidence + severity scoring
│   ├── explainer.py  ← Threat explanation
│   ├── decoder.py    ← Adversarial evasion decoder
│   └── features.py   ← ML feature extractor
├── models/           ← Drop sentinelv5.pkl here before April 3
├── tests/
├── utils/
├── requirements.txt
└── .gitignore
