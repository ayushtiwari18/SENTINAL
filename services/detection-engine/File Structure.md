services/detection-engine/
├── app/
│   ├── main.py        ← FastAPI app + all endpoints
│   ├── schemas.py     ← Request validation
│   ├── rules.py       ← Regex attack detection
│   ├── classifier.py  ← Confidence scoring
│   └── explainer.py   ← Threat explanation
├── models/
├── tests/
├── utils/
├── requirements.txt
└── .gitignore
