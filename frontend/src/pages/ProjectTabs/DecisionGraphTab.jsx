import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Tipuri de noduri pentru Arborele Decizional
const NODE_TYPES = {
  decision: { label: 'Decizie / Întrebare', icon: '❓', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  condition: { label: 'Criteriu / Opțiune', icon: '🔀', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  outcome: { label: 'Concluzie / Rezultat', icon: '🎯', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  risk: { label: 'Risc / Atenționare', icon: '⚠️', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
};

const STATUS_BADGES = {
  RECOMMENDED: { label: 'Recomandat', color: '#059669', bg: '#d1fae5' },
  APPROVED: { label: 'Ales / Aprobat', color: '#2563eb', bg: '#dbeafe' },
  ANALYSIS: { label: 'În analiză', color: '#d97706', bg: '#fef3c7' },
  REJECTED: { label: 'Respins', color: '#dc2626', bg: '#fee2e2' }
};

// Singurul exemplu implicit de Arbore Decizional
const SINGLE_DEFAULT_TREE = {
  id: 'diag-tree-default',
  name: 'Arbore Decizional: Arhitectură Sistem',
  type: 'tree',
  nodes: [
    {
      id: 'node-root',
      parentId: null,
      type: 'decision',
      title: 'Ce arhitectură backend alegem?',
      description: 'Decizie critică pentru faza inițială a proiectului.',
      edgeLabel: '',
      status: 'ANALYSIS',
      x: 60,
      y: 200
    },
    {
      id: 'node-opt-mono',
      parentId: 'node-root',
      type: 'condition',
      title: 'Monolit Modular Spring Boot',
      description: 'Dezvoltare rapidă, o singură instanță de rulare.',
      edgeLabel: 'Opțiunea 1',
      status: 'APPROVED',
      x: 420,
      y: 100
    },
    {
      id: 'node-db-choice',
      parentId: 'node-opt-mono',
      type: 'decision',
      title: 'Ce bază de date asociem?',
      description: 'Integritate relațională vs documente NoSQL.',
      edgeLabel: 'Pas următor',
      status: 'ANALYSIS',
      x: 780,
      y: 100
    },
    {
      id: 'node-db-pg',
      parentId: 'node-db-choice',
      type: 'outcome',
      title: 'PostgreSQL RDBMS (Supabase)',
      description: 'Tranzacții ACID, tabele relaționale, pool conexiuni.',
      edgeLabel: 'ACID / Relațional',
      status: 'RECOMMENDED',
      x: 1140,
      y: 60
    },
    {
      id: 'node-db-nosql',
      parentId: 'node-db-choice',
      type: 'outcome',
      title: 'MongoDB / Document Store',
      description: 'Structură flexibilă, fără foreign keys native.',
      edgeLabel: 'Flexibilitate',
      status: 'ANALYSIS',
      x: 1140,
      y: 190
    },
    {
      id: 'node-opt-micro',
      parentId: 'node-root',
      type: 'condition',
      title: 'Microservicii Independente',
      description: 'Fiecare modul ca serviciu separat Docker.',
      edgeLabel: 'Opțiunea 2',
      status: 'REJECTED',
      x: 420,
      y: 340
    },
    {
      id: 'node-risk-micro',
      parentId: 'node-opt-micro',
      type: 'risk',
      title: 'Complexitate ridicată și costuri de host',
      description: 'Latențe mari de rețea, configurare greoaie pentru MVP.',
      edgeLabel: 'Impact',
      status: 'REJECTED',
      x: 780,
      y: 340
    }
  ]
};

// Șablon de bază pentru o diagramă Ishikawa nouă
const CREATE_ISHIKAWA_TEMPLATE = (name) => ({
  id: `diag-ishikawa-${Date.now()}`,
  name: name || 'Diagramă Ishikawa: Cauze Latență API',
  type: 'ishikawa',
  problem: 'Timp mare de răspuns la încărcarea paginilor (> 3s)',
  categories: [
    {
      id: 'cat-people',
      name: '👥 Oameni / Echipă',
      side: 'top',
      causes: [
        { id: 'c1', text: 'Lipsă instruire optimizare interogări SQL' },
        { id: 'c2', text: 'Code review fără analiză de performanță' }
      ]
    },
    {
      id: 'cat-tech',
      name: '💻 Tehnologie & Cod',
      side: 'top',
      causes: [
        { id: 'c3', text: 'Interogări N+1 la extragerea entităților JPA' },
        { id: 'c4', text: 'Lipsă mecanism de cache pentru date frecvente' }
      ]
    },
    {
      id: 'cat-process',
      name: '⚙️ Procese & Testare',
      side: 'bottom',
      causes: [
        { id: 'c5', text: 'Fără teste automate de încărcare (Load Tests)' },
        { id: 'c6', text: 'Lipsește profilarea memoriei înainte de release' }
      ]
    },
    {
      id: 'cat-infra',
      name: '☁️ Infrastructură & Mediu',
      side: 'bottom',
      causes: [
        { id: 'c7', text: 'Pornire la rece (Cold Start) pe planul gratuit' },
        { id: 'c8', text: 'Pool de conexiuni limitat la 3 instanțe' }
      ]
    }
  ]
});

const NODE_WIDTH = 250;
const NODE_HEIGHT = 110;

function DecisionGraphTab({ projectId, currentUser, permissions = {} }) {
  const storageKey = `project_diagrams_v2_${projectId}`;

  // State principal: listă diagrame + diagramă activă
  const [dataStore, setDataStore] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.diagrams && parsed.diagrams.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return {
      activeId: SINGLE_DEFAULT_TREE.id,
      diagrams: [SINGLE_DEFAULT_TREE]
    };
  });

  // Salvare persistentă
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(dataStore));
    } catch (e) {
      console.error(e);
    }
  }, [dataStore, storageKey]);

  // Diagrama activă curentă
  const currentDiagram = useMemo(() => {
    return dataStore.diagrams.find(d => d.id === dataStore.activeId) || dataStore.diagrams[0];
  }, [dataStore]);

  // Canvas Viewport (pan & zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging nod (Arbore Decizie)
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Modal creare diagramă nouă
  const [showNewDiagramModal, setShowNewDiagramModal] = useState(false);
  const [newDiagForm, setNewDiagForm] = useState({ name: '', type: 'tree' });

  // Modal editare nod (Arbore Decizie)
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editNodeForm, setEditNodeForm] = useState(null);

  // Mod Simulare Decizională (Tree)
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationPath, setSimulationPath] = useState([]);
  const [activeSimNodeId, setActiveSimNodeId] = useState(null);

  // Modal adăugare / editare Ishikawa
  const [showIshikawaModal, setShowIshikawaModal] = useState(false);
  const [ishikawaModalMode, setIshikawaModalMode] = useState('problem'); // 'problem', 'category', 'cause'
  const [ishikawaForm, setIshikawaForm] = useState({ text: '', categoryId: null, causeId: null, side: 'top' });

  // Helper actualizare diagramă activă
  const updateCurrentDiagram = useCallback((updater) => {
    setDataStore(prev => {
      const updatedList = prev.diagrams.map(d => {
        if (d.id === prev.activeId) {
          return typeof updater === 'function' ? updater(d) : { ...d, ...updater };
        }
        return d;
      });
      return { ...prev, diagrams: updatedList };
    });
  }, []);

  // Creare diagramă nouă de la zero
  const handleCreateDiagram = (e) => {
    e.preventDefault();
    if (!newDiagForm.name.trim()) return;

    let newDiag;
    if (newDiagForm.type === 'ishikawa') {
      newDiag = CREATE_ISHIKAWA_TEMPLATE(newDiagForm.name.trim());
    } else {
      // Arbore de decizie nou cu un singur nod rădăcină
      newDiag = {
        id: `diag-tree-${Date.now()}`,
        name: newDiagForm.name.trim(),
        type: 'tree',
        nodes: [
          {
            id: 'node-root',
            parentId: null,
            type: 'decision',
            title: 'Nou punct de pornire decizional...',
            description: 'Definește întrebarea sau decizia principală a proiectului.',
            edgeLabel: '',
            status: 'ANALYSIS',
            x: 80,
            y: 220
          }
        ]
      };
    }

    setDataStore(prev => ({
      activeId: newDiag.id,
      diagrams: [...prev.diagrams, newDiag]
    }));

    setShowNewDiagramModal(false);
    setNewDiagForm({ name: '', type: 'tree' });
    setPan({ x: 40, y: 30 });
    setZoom(1);
    setSimulationMode(false);
  };

  // Ștergere diagramă curentă
  const handleDeleteCurrentDiagram = () => {
    if (dataStore.diagrams.length <= 1) {
      alert("Nu poți șterge singura diagramă a proiectului.");
      return;
    }
    if (!window.confirm(`Sigur vrei să ștergi diagrama "${currentDiagram.name}"?`)) return;

    setDataStore(prev => {
      const remaining = prev.diagrams.filter(d => d.id !== prev.activeId);
      return {
        activeId: remaining[0].id,
        diagrams: remaining
      };
    });
    setSimulationMode(false);
  };

  // --- ARBORE DECIZIONAL: LOGICA NODURILOR ---
  const nodes = currentDiagram.type === 'tree' ? (currentDiagram.nodes || []) : [];

  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const edges = useMemo(() => {
    const list = [];
    nodes.forEach(node => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        list.push({
          id: `edge-${node.parentId}-${node.id}`,
          source: nodeMap.get(node.parentId),
          target: node,
          label: node.edgeLabel || ''
        });
      }
    });
    return list;
  }, [nodes, nodeMap]);

  // Auto layout arborescent
  const handleAutoLayout = () => {
    const childrenMap = new Map();
    let rootNode = null;

    nodes.forEach(n => {
      if (!n.parentId) {
        rootNode = n;
      } else {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId).push(n);
      }
    });

    if (!rootNode && nodes.length > 0) rootNode = nodes[0];
    if (!rootNode) return;

    const newPositions = new Map();
    let currentY = 50;

    const assignPositions = (nodeId, depth) => {
      const children = childrenMap.get(nodeId) || [];
      const x = 60 + depth * 350;

      if (children.length === 0) {
        newPositions.set(nodeId, { x, y: currentY });
        currentY += 160;
      } else {
        children.forEach(child => assignPositions(child.id, depth + 1));
        const firstY = newPositions.get(children[0].id).y;
        const lastY = newPositions.get(children[children.length - 1].id).y;
        const y = (firstY + lastY) / 2;
        newPositions.set(nodeId, { x, y });
      }
    };

    assignPositions(rootNode.id, 0);

    updateCurrentDiagram(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => {
        const pos = newPositions.get(n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      })
    }));
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    });
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId) {
      const newX = Math.round(e.clientX / zoom - dragOffset.x);
      const newY = Math.round(e.clientY / zoom - dragOffset.y);
      updateCurrentDiagram(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  const handleAddTreeNode = (parentId = null, presetType = 'condition') => {
    let parent = parentId ? nodeMap.get(parentId) : null;
    if (!parent && nodes.length > 0) parent = nodes[0];

    const newId = `node-${Date.now()}`;
    const newX = parent ? parent.x + 340 : 60;
    const newY = parent ? parent.y + (Math.random() * 80 - 40) : 200;

    const newNode = {
      id: newId,
      parentId: parent ? parent.id : null,
      type: presetType,
      title: presetType === 'decision' ? 'Nou punct de decizie...' : 'Opțiune sau acțiune nouă...',
      description: 'Descriere și argumente pro/contra...',
      edgeLabel: parent ? 'Ramură nouă' : '',
      status: 'ANALYSIS',
      x: Math.max(20, newX),
      y: Math.max(20, newY)
    };

    updateCurrentDiagram(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setSelectedNodeId(newId);
    setEditNodeForm(newNode);
    setIsEditingNode(true);
  };

  const handleDeleteTreeNode = (nodeId) => {
    if (!window.confirm("Sigur dorești să ștergi acest nod?")) return;

    updateCurrentDiagram(prev => {
      const nodeToDelete = prev.nodes.find(n => n.id === nodeId);
      const newParentId = nodeToDelete ? nodeToDelete.parentId : null;
      const filtered = prev.nodes
        .filter(n => n.id !== nodeId)
        .map(n => n.parentId === nodeId ? { ...n, parentId: newParentId } : n);
      return { ...prev, nodes: filtered };
    });

    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setIsEditingNode(false);
  };

  const handleSaveNodeForm = (e) => {
    e.preventDefault();
    if (!editNodeForm) return;
    updateCurrentDiagram(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === editNodeForm.id ? { ...editNodeForm } : n)
    }));
    setIsEditingNode(false);
  };

  // Simulare decizie
  const startSimulation = () => {
    const root = nodes.find(n => !n.parentId) || nodes[0];
    if (!root) return alert("Nu există noduri pentru simulare!");
    setSimulationMode(true);
    setSimulationPath([root.id]);
    setActiveSimNodeId(root.id);
    setPan({ x: 80, y: 150 });
    setZoom(1);
  };

  const stopSimulation = () => {
    setSimulationMode(false);
    setSimulationPath([]);
    setActiveSimNodeId(null);
  };

  const chooseOptionInSimulation = (childNodeId) => {
    setSimulationPath(prev => [...prev, childNodeId]);
    setActiveSimNodeId(childNodeId);
    const childNode = nodeMap.get(childNodeId);
    if (childNode) {
      setPan({
        x: Math.max(50, 420 - childNode.x * zoom),
        y: Math.max(50, 260 - childNode.y * zoom)
      });
    }
  };

  // --- ISHIKAWA (FISHBONE) LOGICA ---
  const handleOpenEditProblem = () => {
    setIshikawaModalMode('problem');
    setIshikawaForm({ text: currentDiagram.problem || '', categoryId: null, causeId: null, side: 'top' });
    setShowIshikawaModal(true);
  };

  const handleOpenAddCategory = () => {
    setIshikawaModalMode('category');
    setIshikawaForm({ text: '', categoryId: null, causeId: null, side: 'top' });
    setShowIshikawaModal(true);
  };

  const handleOpenAddCause = (catId) => {
    setIshikawaModalMode('cause');
    setIshikawaForm({ text: '', categoryId: catId, causeId: null, side: 'top' });
    setShowIshikawaModal(true);
  };

  const handleOpenEditCause = (catId, cause) => {
    setIshikawaModalMode('cause');
    setIshikawaForm({ text: cause.text, categoryId: catId, causeId: cause.id, side: 'top' });
    setShowIshikawaModal(true);
  };

  const handleSaveIshikawaModal = (e) => {
    e.preventDefault();
    if (!ishikawaForm.text.trim()) return;

    if (ishikawaModalMode === 'problem') {
      updateCurrentDiagram({ problem: ishikawaForm.text.trim() });
    } else if (ishikawaModalMode === 'category') {
      const newCat = {
        id: `cat-${Date.now()}`,
        name: ishikawaForm.text.trim(),
        side: ishikawaForm.side || 'top',
        causes: []
      };
      updateCurrentDiagram(prev => ({
        ...prev,
        categories: [...(prev.categories || []), newCat]
      }));
    } else if (ishikawaModalMode === 'cause') {
      updateCurrentDiagram(prev => ({
        ...prev,
        categories: (prev.categories || []).map(cat => {
          if (cat.id !== ishikawaForm.categoryId) return cat;
          if (ishikawaForm.causeId) {
            // Edit cause
            return {
              ...cat,
              causes: cat.causes.map(c => c.id === ishikawaForm.causeId ? { ...c, text: ishikawaForm.text.trim() } : c)
            };
          } else {
            // Add cause
            return {
              ...cat,
              causes: [...cat.causes, { id: `c-${Date.now()}`, text: ishikawaForm.text.trim() }]
            };
          }
        })
      }));
    }

    setShowIshikawaModal(false);
  };

  const handleDeleteIshikawaCause = (catId, causeId) => {
    updateCurrentDiagram(prev => ({
      ...prev,
      categories: (prev.categories || []).map(cat => {
        if (cat.id !== catId) return cat;
        return { ...cat, causes: cat.causes.filter(c => c.id !== causeId) };
      })
    }));
  };

  const handleDeleteIshikawaCategory = (catId) => {
    if (!window.confirm("Sigur vrei să ștergi această categorie cu toate cauzele ei?")) return;
    updateCurrentDiagram(prev => ({
      ...prev,
      categories: (prev.categories || []).filter(c => c.id !== catId)
    }));
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDiagram, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${currentDiagram.name.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  // Import JSON
  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.type && (parsed.nodes || parsed.categories)) {
          parsed.id = `imported-${Date.now()}`;
          setDataStore(prev => ({
            activeId: parsed.id,
            diagrams: [...prev.diagrams, parsed]
          }));
          alert("Diagrama a fost importată cu succes!");
        } else {
          alert("Format JSON necunoscut.");
        }
      } catch (err) {
        alert("Eroare la import: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  // Simulation helpers
  const simActiveNode = activeSimNodeId ? nodeMap.get(activeSimNodeId) : null;
  const simChildren = useMemo(() => {
    if (!activeSimNodeId) return [];
    return nodes.filter(n => n.parentId === activeSimNodeId);
  }, [nodes, activeSimNodeId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '760px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        position: 'relative'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* TOOLBAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: '#fafaf9',
          borderBottom: '1px solid #e2e8f0',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 10
        }}
      >
        {/* Selector Diagramă & Buton "+ Nouă" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{currentDiagram.type === 'ishikawa' ? '🐟' : '🌳'}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={dataStore.activeId}
                onChange={e => {
                  setDataStore(prev => ({ ...prev, activeId: e.target.value }));
                  setSimulationMode(false);
                }}
                style={{
                  fontWeight: '700',
                  fontSize: '14px',
                  color: '#1e293b',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {dataStore.diagrams.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.type === 'ishikawa' ? '🐟 ' : '🌳 '}{d.name}
                  </option>
                ))}
              </select>

              {/* Buton Creare Nou */}
              <button
                onClick={() => setShowNewDiagramModal(true)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#5a3d5c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
                title="Creează un graf de decizie sau o diagramă Ishikawa nouă"
              >
                + Diagramă Nouă
              </button>

              {dataStore.diagrams.length > 1 && (
                <button
                  onClick={handleDeleteCurrentDiagram}
                  title="Șterge diagrama curentă"
                  style={{
                    padding: '5px 8px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Tip: <strong>{currentDiagram.type === 'ishikawa' ? 'Diagramă Ishikawa (Fishbone - Cauză-Efect)' : 'Arbore de Decizie Interactiv'}</strong>
            </div>
          </div>
        </div>

        {/* Butoane specifice tipului de diagramă */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {currentDiagram.type === 'tree' ? (
            <>
              <button
                onClick={() => handleAddTreeNode(selectedNodeId, 'decision')}
                style={{
                  padding: '6px 11px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Nod Decizie
              </button>
              <button
                onClick={() => handleAddTreeNode(selectedNodeId, 'condition')}
                style={{
                  padding: '6px 11px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Ramură / Opțiune
              </button>
              <button
                onClick={handleAutoLayout}
                style={{
                  padding: '6px 11px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ⚡ Auto-Aranjare
              </button>
              <button
                onClick={simulationMode ? stopSimulation : startSimulation}
                style={{
                  padding: '6px 12px',
                  backgroundColor: simulationMode ? '#dc2626' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {simulationMode ? '⏹️ Oprește Simularea' : '🎮 Simulează Traseul'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleOpenEditProblem}
                style={{
                  padding: '6px 11px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✏️ Modifică Problema (Capul Peștelui)
              </button>
              <button
                onClick={handleOpenAddCategory}
                style={{
                  padding: '6px 11px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Adaugă Categorie (Os Principal)
              </button>
            </>
          )}

          {/* Export / Import */}
          <button
            onClick={handleExportJSON}
            title="Descarcă JSON"
            style={{ padding: '6px 10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
          >
            💾 Export
          </button>
          <label
            title="Importă JSON"
            style={{ padding: '6px 10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'inline-block' }}
          >
            📂 Import
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* CANVAS PRINCIPAL */}
      <div
        className="canvas-background"
        onMouseDown={handleCanvasMouseDown}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          userSelect: 'none'
        }}
      >
        {/* ========================================================= */}
        {/* MOD 1: ARBORE DE DECIZIE (TREE VIEW)                      */}
        {/* ========================================================= */}
        {currentDiagram.type === 'tree' && (
          <>
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {edges.map(edge => {
                  const src = edge.source;
                  const tgt = edge.target;
                  const startX = src.x + NODE_WIDTH;
                  const startY = src.y + NODE_HEIGHT / 2;
                  const endX = tgt.x;
                  const endY = tgt.y + NODE_HEIGHT / 2;
                  const dx = Math.max(50, Math.abs(endX - startX) * 0.45);
                  const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

                  const isEdgeActiveInSim = simulationMode &&
                    simulationPath.includes(src.id) &&
                    simulationPath.includes(tgt.id) &&
                    simulationPath.indexOf(tgt.id) === simulationPath.indexOf(src.id) + 1;

                  const midX = (startX + endX) / 2;
                  const midY = (startY + endY) / 2;

                  return (
                    <g key={edge.id}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isEdgeActiveInSim ? '#059669' : (tgt.status === 'REJECTED' ? '#fca5a5' : '#94a3b8')}
                        strokeWidth={isEdgeActiveInSim ? '3.5' : '2'}
                        strokeDasharray={tgt.status === 'REJECTED' ? '5,5' : 'none'}
                        markerEnd={isEdgeActiveInSim ? 'url(#arrow-active)' : 'url(#arrow)'}
                      />
                      {edge.label && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-50"
                            y="-11"
                            width="100"
                            height="22"
                            rx="11"
                            fill={isEdgeActiveInSim ? '#ecfdf5' : '#ffffff'}
                            stroke={isEdgeActiveInSim ? '#059669' : '#cbd5e1'}
                            strokeWidth="1"
                          />
                          <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="600" fill={isEdgeActiveInSim ? '#065f46' : '#475569'}>
                            {edge.label.length > 16 ? edge.label.slice(0, 14) + '...' : edge.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* NODURI ARBORE */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                zIndex: 2
              }}
            >
              {nodes.map(node => {
                const typeConfig = NODE_TYPES[node.type] || NODE_TYPES.decision;
                const statusConfig = STATUS_BADGES[node.status] || STATUS_BADGES.ANALYSIS;
                const isSelected = selectedNodeId === node.id;
                const isSimActive = simulationMode && activeSimNodeId === node.id;
                const isSimVisited = simulationMode && simulationPath.includes(node.id);

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditNodeForm(node); setIsEditingNode(true); }}
                    style={{
                      position: 'absolute',
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${NODE_WIDTH}px`,
                      minHeight: `${NODE_HEIGHT}px`,
                      backgroundColor: isSimActive ? '#f0fdf4' : '#ffffff',
                      borderRadius: '10px',
                      border: isSimActive
                        ? '2.5px solid #059669'
                        : isSelected
                        ? '2px solid #5a3d5c'
                        : `1px solid ${typeConfig.border}`,
                      boxShadow: isSimActive
                        ? '0 0 16px rgba(5, 150, 105, 0.4)'
                        : isSelected
                        ? '0 8px 24px rgba(90, 61, 92, 0.2)'
                        : '0 2px 8px rgba(0,0,0,0.06)',
                      padding: '12px',
                      boxSizing: 'border-box',
                      cursor: 'move',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: simulationMode && !isSimVisited ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{typeConfig.icon}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: typeConfig.color }}>
                          {typeConfig.label.split('/')[0]}
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px', backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      {node.title}
                    </div>

                    {node.description && (
                      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {node.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '6px', marginTop: '6px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddTreeNode(node.id, 'condition'); }}
                        style={{ border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        + Ramură
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditNodeForm(node); setIsEditingNode(true); }}
                        style={{ border: 'none', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        ✏️
                      </button>
                      {node.parentId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTreeNode(node.id); }}
                          style={{ border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* MOD 2: DIAGRAMĂ ISHIKAWA (FISHBONE VIEW)                  */}
        {/* ========================================================= */}
        {currentDiagram.type === 'ishikawa' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              zIndex: 2,
              minWidth: '1200px',
              minHeight: '650px'
            }}
          >
            {/* SVG PENTRU COLOANA VERTEBRALĂ ȘI OASELE PEȘTELUI */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1200px',
                height: '650px',
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              <defs>
                <marker id="fish-head-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e293b" />
                </marker>
              </defs>

              {/* Coloana vertebrală orizontală principală */}
              <line x1="60" y1="320" x2="800" y2="320" stroke="#1e293b" strokeWidth="5" markerEnd="url(#fish-head-arrow)" />

              {/* Coastele diagonale ale categoriilor */}
              {(currentDiagram.categories || []).map((cat, idx) => {
                const totalCats = currentDiagram.categories.length;
                // Calcul poziție X de-a lungul coloanei (de la stânga spre dreapta)
                const spineX = 180 + idx * Math.floor(580 / Math.max(1, totalCats));
                const isTop = cat.side === 'top';
                const ribStartX = spineX - 100;
                const ribStartY = isTop ? 100 : 540;

                return (
                  <g key={cat.id}>
                    {/* Linia osului principal către coloana vertebrală */}
                    <line
                      x1={ribStartX}
                      y1={ribStartY}
                      x2={spineX}
                      y2="320"
                      stroke="#475569"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Liniile orizontale mici pentru fiecare cauză */}
                    {(cat.causes || []).map((cause, cIdx) => {
                      const t = (cIdx + 1) / (cat.causes.length + 1);
                      const branchX = ribStartX + (spineX - ribStartX) * t;
                      const branchY = ribStartY + (320 - ribStartY) * t;
                      const lineLength = 140;

                      return (
                        <g key={cause.id}>
                          <line
                            x1={branchX}
                            y1={branchY}
                            x2={branchX - lineLength}
                            y2={branchY}
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeDasharray="2,2"
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* CAPUL PEȘTELUI (EFECTUL / PROBLEMA PRINCIPALĂ) */}
            <div
              onClick={handleOpenEditProblem}
              style={{
                position: 'absolute',
                left: '810px',
                top: '255px',
                width: '280px',
                backgroundColor: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)',
                cursor: 'pointer',
                zIndex: 5
              }}
              title="Click pentru a schimba problema principală analizată"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#b91c1c', letterSpacing: '0.5px' }}>
                  🐟 EFECTUL / PROBLEMA
                </span>
                <span style={{ fontSize: '12px', color: '#ef4444' }}>✏️</span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', lineHeight: '1.4' }}>
                {currentDiagram.problem || 'Problema principală analizată...'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                Click pentru a edita enunțul problemei
              </div>
            </div>

            {/* CUTIILE CATEGORIILOR ȘI CAUZELE LOR */}
            {(currentDiagram.categories || []).map((cat, idx) => {
              const totalCats = currentDiagram.categories.length;
              const spineX = 180 + idx * Math.floor(580 / Math.max(1, totalCats));
              const isTop = cat.side === 'top';
              const ribStartX = spineX - 100;
              const ribStartY = isTop ? 100 : 540;

              return (
                <div key={cat.id}>
                  {/* Card Categorie (Capătul osului) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${ribStartX - 90}px`,
                      top: `${isTop ? ribStartY - 45 : ribStartY + 10}px`,
                      width: '180px',
                      backgroundColor: '#eff6ff',
                      border: '1.5px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 10px rgba(59, 130, 246, 0.15)',
                      zIndex: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700', fontSize: '12px', color: '#1e3a8a' }}>
                        {cat.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteIshikawaCategory(cat.id); }}
                        title="Șterge categoria"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '11px' }}
                      >
                        ✕
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenAddCause(cat.id)}
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        padding: '3px 6px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      + Cauză
                    </button>
                  </div>

                  {/* Noduri / Pastile de Cauze de-a lungul osului */}
                  {(cat.causes || []).map((cause, cIdx) => {
                    const t = (cIdx + 1) / (cat.causes.length + 1);
                    const branchX = ribStartX + (spineX - ribStartX) * t;
                    const branchY = ribStartY + (320 - ribStartY) * t;
                    const lineLength = 140;

                    return (
                      <div
                        key={cause.id}
                        onClick={() => handleOpenEditCause(cat.id, cause)}
                        style={{
                          position: 'absolute',
                          left: `${branchX - lineLength - 130}px`,
                          top: `${branchY - 14}px`,
                          width: '130px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          fontSize: '11px',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          zIndex: 4
                        }}
                        title="Click pentru editare cauză"
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cause.text}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteIshikawaCause(cat.id, cause.id);
                          }}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '0 2px' }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* CONTROALE ZOOM (Dreapta-Jos) */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backgroundColor: '#ffffff',
            padding: '6px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #cbd5e1',
            zIndex: 10
          }}
        >
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.15))}
            title="Zoom in"
            style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', background: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            +
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
            title="Zoom out"
            style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', background: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            -
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 40, y: 30 }); }}
            title="Resetare vedere"
            style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', background: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
          >
            1:1
          </button>
        </div>

        {/* BANNER SIMULARE ARBORE DECIZIONAL */}
        {simulationMode && currentDiagram.type === 'tree' && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              backgroundColor: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              border: '2px solid #059669',
              maxWidth: '460px',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎮</span> Simulare Decizie
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Pasul {simulationPath.length}</span>
            </div>

            {simActiveNode ? (
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
                  {simActiveNode.title}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  {simActiveNode.description}
                </div>

                {simChildren.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Alege opțiunea următoare:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {simChildren.map(child => (
                        <button
                          key={child.id}
                          onClick={() => chooseOptionInSimulation(child.id)}
                          style={{
                            padding: '7px 12px',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '6px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span style={{ fontWeight: '600', fontSize: '12px', color: '#065f46' }}>
                            {child.edgeLabel ? `${child.edgeLabel}: ` : ''}{child.title}
                          </span>
                          <span style={{ fontSize: '12px', color: '#059669' }}>➔</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontWeight: '700', color: '#166534', fontSize: '13px' }}>
                      🎉 Ai atins concluzia acestui traseu decizional!
                    </div>
                    <button
                      onClick={startSimulation}
                      style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Reia de la început 🔄
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* MODAL CREARE DIAGRAMĂ NOUĂ */}
      {showNewDiagramModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300
          }}
          onClick={() => setShowNewDiagramModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '28px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '18px' }}>
              ➕ Creează o Diagramă Nouă
            </h3>

            <form onSubmit={handleCreateDiagram} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                  Numele Diagramei
                </label>
                <input
                  type="text"
                  placeholder="Ex: Arbore Decizie Frontend, Ishikawa Erori..."
                  value={newDiagForm.name}
                  onChange={e => setNewDiagForm({ ...newDiagForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                  Tipul de Diagramă
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setNewDiagForm({ ...newDiagForm, type: 'tree' })}
                    style={{
                      border: newDiagForm.type === 'tree' ? '2px solid #5a3d5c' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      backgroundColor: newDiagForm.type === 'tree' ? '#faf5ff' : '#ffffff',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>🌳</div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Arbore Decizional</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Ramuri, opțiuni, criterii și simulare
                    </div>
                  </div>

                  <div
                    onClick={() => setNewDiagForm({ ...newDiagForm, type: 'ishikawa' })}
                    style={{
                      border: newDiagForm.type === 'ishikawa' ? '2px solid #5a3d5c' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      backgroundColor: newDiagForm.type === 'ishikawa' ? '#faf5ff' : '#ffffff',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>🐟</div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Diagramă Ishikawa</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Fishbone (Cauză - Efect, categorii)
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewDiagramModal(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Creează Diagrama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ISHIKAWA (EDITARE PROBLEMĂ / CATEGORIE / CAUZĂ) */}
      {showIshikawaModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300
          }}
          onClick={() => setShowIshikawaModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '26px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '17px' }}>
              {ishikawaModalMode === 'problem' && '🐟 Modifică Problema Principală (Efectul)'}
              {ishikawaModalMode === 'category' && '➕ Adaugă Categorie Ishikawa (Os principal)'}
              {ishikawaModalMode === 'cause' && (ishikawaForm.causeId ? '✏️ Editare Cauză' : '➕ Adaugă o Cauză')}
            </h3>

            <form onSubmit={handleSaveIshikawaModal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                  {ishikawaModalMode === 'problem' && 'Descrierea Efectului / Problemei de rezolvat'}
                  {ishikawaModalMode === 'category' && 'Nume Categorie (ex: 👥 Oameni, ⚙️ Procese, 💻 Tehnologie)'}
                  {ishikawaModalMode === 'cause' && 'Textul Cauzei (ex: Interogare SQL neoptimizată)'}
                </label>
                <input
                  type="text"
                  value={ishikawaForm.text}
                  onChange={e => setIshikawaForm({ ...ishikawaForm, text: e.target.value })}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {ishikawaModalMode === 'category' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                    Poziționare pe schelet
                  </label>
                  <select
                    value={ishikawaForm.side}
                    onChange={e => setIshikawaForm({ ...ishikawaForm, side: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="top">Sus (Partea superioară)</option>
                    <option value="bottom">Jos (Partea inferioară)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowIshikawaModal(false)}
                  style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Salvează
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITARE NOD ARBORE DECIZIONAL */}
      {isEditingNode && editNodeForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300
          }}
          onClick={() => setIsEditingNode(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '26px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '17px' }}>
                ✏️ Editare Nod Decizional
              </h3>
              <button onClick={() => setIsEditingNode(false)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleSaveNodeForm} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Tipul Nodului</label>
                <select
                  value={editNodeForm.type}
                  onChange={e => setEditNodeForm({ ...editNodeForm, type: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="decision">❓ Decizie / Întrebare Principală</option>
                  <option value="condition">🔀 Criteriu / Ramură Opțiune</option>
                  <option value="outcome">🎯 Concluzie / Rezultat Final</option>
                  <option value="risk">⚠️ Risc / Atenționare</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Titlu / Enunț</label>
                <input
                  type="text"
                  value={editNodeForm.title}
                  onChange={e => setEditNodeForm({ ...editNodeForm, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {editNodeForm.parentId && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Etichetă ramură (ex: "Opțiunea A", "Dacă Da")
                  </label>
                  <input
                    type="text"
                    value={editNodeForm.edgeLabel || ''}
                    onChange={e => setEditNodeForm({ ...editNodeForm, edgeLabel: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Stare Decizie</label>
                <select
                  value={editNodeForm.status}
                  onChange={e => setEditNodeForm({ ...editNodeForm, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="ANALYSIS">În analiză (Galben)</option>
                  <option value="RECOMMENDED">Recomandat (Verde)</option>
                  <option value="APPROVED">Ales / Aprobat (Albastru)</option>
                  <option value="REJECTED">Respins (Roșu)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Descriere / Argumente</label>
                <textarea
                  value={editNodeForm.description || ''}
                  onChange={e => setEditNodeForm({ ...editNodeForm, description: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                {editNodeForm.parentId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTreeNode(editNodeForm.id)}
                    style={{ padding: '7px 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🗑️ Șterge Nod
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingNode(false)}
                    style={{ padding: '7px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '7px 16px', backgroundColor: '#5a3d5c', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Salvează
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecisionGraphTab;
