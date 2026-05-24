import React, { useState, useMemo } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';

const WavetableGenerator = () => {
  const [arrayName, setArrayName] = useState('wavetable');
  const [useProgmem, setUseProgmem] = useState(true);
  const [dataType, setDataType] = useState('uint8_t');
  const [tableSize, setTableSize] = useState(256);
  const [waves, setWaves] = useState([
    { id: 1, type: 'sine', volume: 1.0, freqMult: 1, customFreq: false, customFreqValue: 1, phase: 0 }
  ]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(0.5);
  const MAX_WAVES = 8;
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customMin, setCustomMin] = useState(0);
  const [customMax, setCustomMax] = useState(255);
  const [waveformHeight, setWaveformHeight] = useState(150);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(150);

  const handleResizeStart = (e) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(waveformHeight);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const delta = e.clientY - dragStartY;
        const newHeight = Math.max(100, Math.min(400, dragStartHeight + delta));
        setWaveformHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartHeight]);

  React.useEffect(() => {
    document.body.style.backgroundColor = '#111827';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  // Aggiorna custom range quando cambia il data type
  React.useEffect(() => {
    if (!useCustomRange) {
      switch (dataType) {
        case 'uint8_t':
          setCustomMin(0);
          setCustomMax(255);
          break;
        case 'int8_t':
          setCustomMin(-127);
          setCustomMax(127);
          break;
        case 'uint16_t':
          setCustomMin(0);
          setCustomMax(65535);
          break;
        case 'int16_t':
          setCustomMin(-32767);
          setCustomMax(32767);
          break;
      }
    }
  }, [dataType, useCustomRange]);

  const waveGenerators = {
    sine: (t, freq, phase) => Math.sin(2 * Math.PI * freq * t + phase),
    triangle: (t, freq, phase) => {
      const p = (freq * t + phase / (2 * Math.PI)) % 1;
      return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    },
    square: (t, freq, phase) => {
      const p = (freq * t + phase / (2 * Math.PI)) % 1;
      return p < 0.5 ? 1 : -1;
    },
    saw: (t, freq, phase) => {
      const p = (freq * t + phase / (2 * Math.PI)) % 1;
      return 2 * p - 1;
    },
    ramp: (t, freq, phase) => {
      const p = (freq * t + phase / (2 * Math.PI)) % 1;
      return 1 - 2 * p;
    },
    noise: () => Math.random() * 2 - 1
  };

  const generateWaveform = useMemo(() => {
    const data = [];
    
    for (let i = 0; i < tableSize; i++) {
      const t = i / tableSize;
      let sample = 0;
      
      waves.forEach(wave => {
        const freq = wave.customFreq ? wave.customFreqValue : wave.freqMult;
        const phaseRad = (wave.phase * Math.PI) / 180;
        sample += waveGenerators[wave.type](t, freq, phaseRad) * wave.volume;
      });
      
      data.push(sample);
    }
    
    // Normalizza per coprire sempre l'intero range -1 a +1
    const max = Math.max(...data.map(Math.abs));
    if (max > 0) {
      return data.map(v => v / max);
    }
    return data;
  }, [waves, tableSize]);

  const convertToDataType = (normalizedValue) => {
    // Se custom range è abilitato, mappa direttamente su quel range
    if (useCustomRange) {
      const range = customMax - customMin;
      return Math.round(customMin + (normalizedValue * 0.5 + 0.5) * range);
    }
    
    // Altrimenti usa il range del data type
    switch (dataType) {
      case 'uint8_t':
        return Math.floor((normalizedValue * 0.5 + 0.5) * 256) & 0xFF;
      case 'int8_t':
        return Math.round(normalizedValue * 127);
      case 'uint16_t':
        return Math.floor((normalizedValue * 0.5 + 0.5) * 65536) & 0xFFFF;
      case 'int16_t':
        return Math.round(normalizedValue * 32767);
      default:
        return 0;
    }
  };

  const generateArrayString = () => {
    const values = generateWaveform.map(convertToDataType);
    const progmem = useProgmem ? 'PROGMEM ' : '';
    
    // Quando custom range è attivo, usa int16_t come tipo
    const actualDataType = useCustomRange ? 'int16_t' : dataType;
    
    let output = `const ${actualDataType} ${progmem}${arrayName}[${tableSize}] = {\n  `;
    
    for (let i = 0; i < values.length; i++) {
      output += values[i];
      if (i < values.length - 1) {
        output += ', ';
        if ((i + 1) % 16 === 0) output += '\n  ';
      }
    }
    
    output += '\n};';
    return output;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateArrayString());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const addWave = () => {
    if (waves.length < MAX_WAVES) {
      setWaves([...waves, {
        id: Date.now(),
        type: 'sine',
        volume: 0.5,
        freqMult: 1,
        customFreq: false,
        customFreqValue: 1,
        phase: 0
      }]);
    }
  };

  const removeWave = (id) => {
    if (waves.length > 1) {
      setWaves(waves.filter(w => w.id !== id));
    }
  };

  const updateWave = (id, field, value) => {
    setWaves(waves.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const playPreview = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 1.0;
    const frequency = 440;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    
    // Crea buffer audio
    const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Usa direttamente la waveform normalizzata (già in range -1 a +1)
    const waveform = generateWaveform;
    const waveformLength = waveform.length;
    
    // Riempie il buffer
    for (let i = 0; i < numSamples; i++) {
      const phase = (i * frequency / sampleRate) % 1.0;
      const floatIndex = phase * waveformLength;
      const index0 = Math.floor(floatIndex) % waveformLength;
      const index1 = (index0 + 1) % waveformLength;
      const frac = floatIndex - Math.floor(floatIndex);
      
      channelData[i] = waveform[index0] * (1 - frac) + waveform[index1] * frac;
    }
    
    // Setup audio nodes
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Envelope con volume da slider
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(previewVolume, now + 0.01);
    gainNode.gain.setValueAtTime(previewVolume, now + duration - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    source.start(now);
    source.stop(now + duration);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <h1 className="text-xl font-bold text-center mb-4">Wavetable Generator</h1>
        <div className="bg-gray-800 rounded p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Waveform</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={playPreview}
                className="flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-sm"
              >
                <span>Preview</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm">Vol:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={previewVolume}
                  onChange={(e) => setPreviewVolume(parseFloat(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm w-8">{Math.round(previewVolume * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded relative" style={{ height: `${waveformHeight}px` }}>
            <svg width="100%" height="100%" viewBox={`0 0 1000 ${waveformHeight}`} preserveAspectRatio="none">
              <line x1="0" y1={waveformHeight/2} x2="1000" y2={waveformHeight/2} stroke="#374151" strokeWidth="1" />
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={generateWaveform.map((v, i) => 
                  `${(i / tableSize) * 1000},${waveformHeight/2 - v * (waveformHeight * 0.4)}`
                ).join(' ')}
              />
            </svg>
            <div
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize flex items-center justify-center"
              style={{ userSelect: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 11L11 14M14 6L6 14M14 1L1 14" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Waves ({waves.length}/{MAX_WAVES})</h2>
            <button
              onClick={addWave}
              disabled={waves.length >= MAX_WAVES}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-2 py-1 rounded text-base"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {waves.map((wave, index) => (
              <div key={wave.id} className="bg-gray-700 rounded p-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-xs">Wave {index + 1}</span>
                  {waves.length > 1 && (
                    <button
                      onClick={() => removeWave(wave.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-base mb-1">Type</label>
                    <select
                      value={wave.type}
                      onChange={(e) => updateWave(wave.id, 'type', e.target.value)}
                      className="w-full bg-gray-600 rounded px-2 py-1 text-base"
                    >
                      <option value="sine">Sine</option>
                      <option value="triangle">Triangle</option>
                      <option value="square">Square</option>
                      <option value="saw">Saw</option>
                      <option value="ramp">Ramp</option>
                      <option value="noise">Noise</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-base mb-1">Vol: {wave.volume.toFixed(2)}</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={wave.volume}
                      onChange={(e) => updateWave(wave.id, 'volume', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <label className="text-base">Freq</label>
                      <input
                        type="checkbox"
                        checked={wave.customFreq}
                        onChange={(e) => updateWave(wave.id, 'customFreq', e.target.checked)}
                        className="w-3 h-3"
                      />
                      <span className="text-base">Custom</span>
                    </div>
                    {wave.customFreq ? (
                      <input
                        type="number"
                        min="0.1"
                        max="32"
                        step="0.1"
                        value={wave.customFreqValue}
                        onChange={(e) => updateWave(wave.id, 'customFreqValue', parseFloat(e.target.value))}
                        className="w-full bg-gray-600 rounded px-2 py-1 text-base"
                      />
                    ) : (
                      <select
                        value={wave.freqMult}
                        onChange={(e) => updateWave(wave.id, 'freqMult', parseInt(e.target.value))}
                        className="w-full bg-gray-600 rounded px-2 py-1 text-base"
                      >
                        {[1,2,3,4,5,6,7,8].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-base mb-1">Phase</label>
                    <div className="flex gap-1 items-center">
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={Math.round(wave.phase)}
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value));
                          updateWave(wave.id, 'phase', val);
                        }}
                        className="w-full"
                      />
                      <input
                        type="number"
                        min="0"
                        max="360"
                        step="1"
                        value={Math.round(wave.phase)}
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value));
                          if (val >= 0 && val <= 360) {
                            updateWave(wave.id, 'phase', val);
                          }
                        }}
                        className="w-14 bg-gray-600 rounded px-1 py-0.5 text-sm text-center flex-shrink-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-lg font-semibold mb-2">C/C++ Array</h2>
          <div className="flex gap-3">
            <div className="w-48 flex-shrink-0 space-y-2">
              <div>
                <label className="block text-base mb-1">Array Name</label>
                <input
                  type="text"
                  value={arrayName}
                  onChange={(e) => setArrayName(e.target.value)}
                  className="w-full bg-gray-700 rounded px-2 py-1 text-base"
                />
              </div>
              
              <div>
                <label className="block text-base mb-1">Data Type</label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  className="w-full bg-gray-700 rounded px-2 py-1 text-base"
                >
                  <option value="uint8_t">uint8_t</option>
                  <option value="int8_t">int8_t</option>
                  <option value="uint16_t">uint16_t</option>
                  <option value="int16_t">int16_t</option>
                </select>
              </div>
              
              <div>
                <label className="block text-base mb-1">Size</label>
                <select
                  value={tableSize}
                  onChange={(e) => setTableSize(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded px-2 py-1 text-base"
                >
                  <option value="64">64</option>
                  <option value="128">128</option>
                  <option value="256">256</option>
                  <option value="512">512</option>
                  <option value="1024">1024</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center space-x-2 cursor-pointer text-base">
                  <input
                    type="checkbox"
                    checked={useProgmem}
                    onChange={(e) => setUseProgmem(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <span>PROGMEM</span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center space-x-2 cursor-pointer text-base mb-1">
                  <input
                    type="checkbox"
                    checked={useCustomRange}
                    onChange={(e) => setUseCustomRange(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <span>Custom Range</span>
                </label>
                {useCustomRange && (
                  <div className="space-y-1">
                    <div>
                      <label className="block text-xs mb-0.5">Min</label>
                      <input
                        type="number"
                        value={customMin}
                        onChange={(e) => setCustomMin(parseInt(e.target.value))}
                        className="w-full bg-gray-700 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-0.5">Max</label>
                      <input
                        type="number"
                        value={customMax}
                        onChange={(e) => setCustomMax(parseInt(e.target.value))}
                        className="w-full bg-gray-700 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center space-x-1 bg-green-600 hover:bg-green-700 px-2 py-1.5 rounded text-base"
              >
                <Copy size={14} />
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            
            <div className="flex-1 min-w-0">
              <pre className="bg-gray-900 rounded p-2 overflow-x-auto text-xs h-full">
                <code>{generateArrayString()}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WavetableGenerator;
