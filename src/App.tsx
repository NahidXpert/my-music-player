import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownAZ, ArrowLeft, ArrowRight, Check, ChevronDown, FileAudio, Heart,
  Home, Library, ListMusic, Menu, Music2, Pause, Pencil, Play, Plus, Repeat,
  Search, Settings, Shuffle, Sparkles, Trash2, Upload, Volume2, X, Zap,
} from 'lucide-react'
import { loadState, removePlaylist, removeTrack, savePlaylists, savePreferences, saveTrackMetadata, saveTracks, storageErrorMessage } from './lib/db'
import { isSupportedAudio, readTrack } from './lib/metadata'
import { formatTime, toneForTrack, type Playlist, type RepeatMode, type Track } from './lib/models'
import { nextTrack, previousTrack } from './lib/queue'

type View = 'Home' | 'Library' | 'Favorites' | 'Playlists' | 'Settings'
const navItems: { label: View; icon: typeof Home }[] = [
  { label: 'Home', icon: Home }, { label: 'Library', icon: Library },
  { label: 'Favorites', icon: Heart }, { label: 'Playlists', icon: ListMusic },
]

function Artwork({ track, size = 'medium' }: { track?: Track; size?: 'small' | 'medium' | 'large' }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!track?.artwork) { setUrl(''); return }
    const objectUrl = URL.createObjectURL(track.artwork); setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [track?.artwork])
  if (url) return <div className={`artwork artwork-${size}`} style={{ backgroundImage: `url("${url}")` }} aria-label={`${track?.title} artwork`} />
  return <div className={`artwork artwork-${toneForTrack(track ?? { id: '00' })} artwork-${size}`} aria-hidden="true"><span>R</span><i /></div>
}

function Button({ children, className = '', variant = 'ghost', onClick, label, disabled = false }: { children: React.ReactNode; className?: string; variant?: 'ghost' | 'primary' | 'soft'; onClick?: () => void; label?: string; disabled?: boolean }) {
  return <button type="button" aria-label={label} disabled={disabled} className={`button button-${variant} ${className}`} onClick={onClick}>{children}</button>
}

function Sidebar({ view, setView, onImport, favoriteCount }: { view: View; setView: (v: View) => void; onImport: () => void; favoriteCount: number }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">R</div><span>ROGUE</span></div><div className="sidebar-label">YOUR SPACE</div>
    <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={view === label ? 'nav-item active' : 'nav-item'} onClick={() => setView(label)}><Icon size={19} /><span>{label}</span>{label === 'Favorites' && <span className="nav-count">{favoriteCount}</span>}</button>)}</nav>
    <div className="sidebar-divider" /><button className="nav-item import-link" onClick={onImport}><Upload size={19} /><span>Import music</span><span className="plus-badge">+</span></button><div className="sidebar-spacer" />
    <div className="sidebar-tip"><Sparkles size={16} /><p><strong>YOUR MUSIC.</strong><br />No accounts. No algorithms. Just you.</p></div>
    <button className="nav-item" onClick={() => setView('Settings')}><Settings size={19} /><span>Settings</span></button>
  </aside>
}

function Header({ view, filter, onImport, onSearch, onBack, onForward, canGoBack, canGoForward, setView }: { view: View; filter: string; onImport: () => void; onSearch: (value: string) => void; onBack: () => void; onForward: () => void; canGoBack: boolean; canGoForward: boolean; setView: (view: View) => void }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const chooseView = (nextView: View) => { setView(nextView); setMenuOpen(false) }
  return <header className="topbar"><div className="history-buttons"><Button label="Go back" onClick={onBack} disabled={!canGoBack}><ArrowLeft size={18} /></Button><Button label="Go forward" onClick={onForward} disabled={!canGoForward}><ArrowRight size={18} /></Button></div><div className="mobile-brand"><div className="brand-mark">R</div>ROGUE</div><div className={`header-search ${searchOpen ? 'search-open' : ''}`}><button className="mobile-search-toggle" aria-label="Open search" onClick={() => setSearchOpen(true)}><Search size={17} /></button><input aria-label={`Search ${view.toLowerCase()}`} value={filter} placeholder={`Search ${view.toLowerCase()}...`} onChange={(e) => onSearch(e.target.value)} /><kbd>⌘ K</kbd>{searchOpen && <button className="mobile-search-close" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={15} /></button>}</div><Button variant="soft" className="header-import" onClick={onImport}><Upload size={16} /><span>Import music</span></Button><Button className="mobile-menu" label="Menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} /></Button>{menuOpen && <div className="mobile-nav-drawer"><button onClick={() => chooseView('Home')}>Home</button><button onClick={() => chooseView('Library')}>Library</button><button onClick={() => chooseView('Favorites')}>Favorites</button><button onClick={() => chooseView('Playlists')}>Playlists</button><button onClick={() => chooseView('Settings')}>Settings</button><button onClick={() => { onImport(); setMenuOpen(false) }}>Import music</button></div>}</header>
}

function EmptyState({ type, onAction, message }: { type: 'playlist' | 'library' | 'search'; onAction?: () => void; message?: string }) {
  const content = {
    playlist: { icon: ListMusic, eyebrow: 'MAKE IT YOURS', title: 'Your playlists are waiting.', copy: 'Build the perfect soundtrack for every version of you.', action: 'Create a playlist' },
    library: { icon: FileAudio, eyebrow: 'NOTHING HERE YET', title: 'Your library is empty.', copy: 'Drop in some local audio and make this space yours.', action: 'Import music' },
    search: { icon: Search, eyebrow: 'NO SIGNAL', title: 'Nothing matched that search.', copy: message ?? 'Try a different title, artist, or album.' },
  }[type]; const Icon = content.icon
  return <div className="empty-state"><div className="empty-icon"><Icon size={28} /></div><p className="eyebrow">{content.eyebrow}</p><h2>{content.title}</h2><p>{content.copy}</p>{content.action && onAction && <Button variant="primary" onClick={onAction}><Plus size={16} />{content.action}</Button>}</div>
}

function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <div className="page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div> }
function SectionHeading({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-heading"><h2>{title}</h2>{action && <button onClick={onClick}>{action}<ArrowRight size={14} /></button>}</div> }
function TrackCard({ track, onClick, onFavorite }: { track: Track; onClick: () => void; onFavorite: () => void }) { return <div className="track-card"><button onClick={onClick} className="track-card-main"><Artwork track={track} /><span className="card-play"><Play size={17} fill="currentColor" /></span><span className="card-meta"><strong>{track.title}</strong><span>{track.artist}</span></span></button><button className="card-favorite" aria-label={track.favorite ? 'Remove favorite' : 'Add favorite'} onClick={onFavorite}><Heart size={16} fill={track.favorite ? 'currentColor' : 'none'} /></button></div> }
function CompactTrack({ track, onClick, onFavorite }: { track: Track; onClick: () => void; onFavorite: () => void }) { return <button className="compact-track" onClick={onClick}><Artwork track={track} size="small" /><div><strong>{track.title}</strong><span>{track.artist} · {track.album}</span></div><span className="track-duration">{formatTime(track.duration)}</span><span onClick={(e) => { e.stopPropagation(); onFavorite() }} className={track.favorite ? 'favorite-icon' : ''}><Heart size={15} fill={track.favorite ? 'currentColor' : 'none'} /></span></button> }

function HomeView({ tracks, recent, setView, onImport, play, favorite }: { tracks: Track[]; recent: Track[]; setView: (v: View) => void; onImport: () => void; play: (track: Track) => void; favorite: (id: string) => void }) {
  const shown = recent.length ? recent : tracks.slice(0, 4)
  return <div className="view-content home-view"><section className="welcome"><div><p className="eyebrow">WEDNESDAY, OCTOBER 29</p><h1>Good evening,<br /><em>listener.</em></h1><p className="welcome-copy">{tracks.length ? 'Your music is ready when you are.' : 'Your local frequency starts here.'}</p><Button variant="primary" onClick={tracks.length ? () => setView('Library') : onImport}><Play size={16} fill="currentColor" />{tracks.length ? 'Open your library' : 'Import your music'}</Button></div><div className="welcome-art"><div className="burst">R</div><div className="burst-caption">ROGUE<br /><span>LOCAL FREQUENCY</span></div></div></section>{tracks.length ? <><section className="section"><SectionHeading title="Recently played" action="See all" onClick={() => setView('Library')} /><div className="track-grid">{shown.slice(0, 4).map((track) => <TrackCard key={track.id} track={track} onClick={() => play(track)} onFavorite={() => favorite(track.id)} />)}</div></section><section className="section split-section"><div><SectionHeading title="Recently added" action="See all" onClick={() => setView('Library')} /><div className="compact-list">{tracks.slice(-3).map((track) => <CompactTrack key={track.id} track={track} onClick={() => play(track)} onFavorite={() => favorite(track.id)} />)}</div></div><div><SectionHeading title="Your playlists" action="View all" onClick={() => setView('Playlists')} /><div className="playlist-card" onClick={() => setView('Playlists')}><div className="playlist-collage"><Artwork track={tracks[0]} size="small" /><Artwork track={tracks[1] ?? tracks[0]} size="small" /><Artwork track={tracks[2] ?? tracks[0]} size="small" /><Artwork track={tracks[3] ?? tracks[0]} size="small" /></div><div><span className="eyebrow">CURATED BY YOU</span><h3>{'Late night energy'}</h3><p>Build your first collection</p></div><ChevronDown size={18} /></div></div></section></> : <div className="section"><EmptyState type="library" onAction={onImport} /></div>}</div>
}

function LibraryView({ tracks, filter, setFilter, play, favorite, remove, onImport, addQueue }: { tracks: Track[]; filter: string; setFilter: (v: string) => void; play: (track: Track) => void; favorite: (id: string) => void; remove: (id: string) => void; onImport: () => void; addQueue: (track: Track) => void }) {
  const [sort, setSort] = useState<'title' | 'artist' | 'album' | 'duration' | 'addedAt'>('addedAt')
  const filtered = useMemo(() => tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => String(a[sort]).localeCompare(String(b[sort]))), [filter, sort, tracks])
  return <div className="view-content"><PageIntro eyebrow="YOUR COLLECTION" title="Library" copy={`${tracks.length} local track${tracks.length === 1 ? '' : 's'} · Files stay on this device.`} />{tracks.length === 0 ? <EmptyState type="library" onAction={onImport} /> : <><div className="library-toolbar"><div className="filter-chip"><Music2 size={15} />{filtered.length} shown</div><div className="toolbar-actions"><Button variant="soft" onClick={() => setSort(sort === 'title' ? 'addedAt' : 'title')}><ArrowDownAZ size={16} />Sort: {sort === 'addedAt' ? 'Recently added' : sort}<ChevronDown size={15} /></Button><Button variant="primary" onClick={onImport}><Upload size={15} />Import</Button></div></div>{filtered.length ? <div className="track-table"><div className="table-head"><span>#</span><span>Title</span><span>Album</span><span>Added</span><span>Time</span><span /></div>{filtered.map((track, i) => <div className="table-row" key={track.id}><span className="row-number">{String(i + 1).padStart(2, '0')}</span><button className="row-title" onClick={() => play(track)}><Artwork track={track} size="small" /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button><span className="muted">{track.album}</span><span className="muted">{new Date(track.addedAt).toLocaleDateString()}</span><span className="muted">{formatTime(track.duration)}</span><button className={track.favorite ? 'favorite-icon icon-action' : 'muted icon-action'} aria-label="Toggle favorite" onClick={() => favorite(track.id)}><Heart size={16} fill={track.favorite ? 'currentColor' : 'none'} /></button><div className="row-actions"><button aria-label="Add to queue" onClick={() => addQueue(track)}><Plus size={15} /></button><button aria-label="Remove track" onClick={() => remove(track.id)}><Trash2 size={15} /></button></div></div>)}</div> : <EmptyState type="search" />}</>}</div>
}

function PlaylistsView({ playlists, tracks, setPlaylists, play, favorite }: { playlists: Playlist[]; tracks: Track[]; setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>; play: (track: Track) => void; favorite: (id: string) => void }) {
  const [selected, setSelected] = useState<string>()
  const playlist = playlists.find((item) => item.id === selected)
  const create = () => { const name = window.prompt('Playlist name', 'New playlist')?.trim(); if (!name) return; const now = Date.now(); const next = { id: crypto.randomUUID(), name, trackIds: [], createdAt: now, updatedAt: now }; setPlaylists((items) => [...items, next]) }
  const rename = () => { if (!playlist) return; const name = window.prompt('Rename playlist', playlist.name)?.trim(); if (name) setPlaylists((items) => items.map((item) => item.id === playlist.id ? { ...item, name, updatedAt: Date.now() } : item)) }
  const remove = () => { if (playlist && window.confirm(`Delete "${playlist.name}"?`)) { setPlaylists((items) => items.filter((item) => item.id !== playlist.id)); setSelected(undefined) } }
  const addTrack = () => { if (!playlist) return; const query = window.prompt(`Add a track to "${playlist.name}"\nType a title or artist:`)?.trim().toLowerCase(); if (!query) return; const track = tracks.find((item) => `${item.title} ${item.artist}`.toLowerCase().includes(query) && !playlist.trackIds.includes(item.id)); if (!track) { window.alert('No matching track found, or it is already in this playlist.'); return } setPlaylists((items) => items.map((item) => item.id === playlist.id ? { ...item, trackIds: [...item.trackIds, track.id], updatedAt: Date.now() } : item)) }
  const updateTrackIds = (trackId: string, direction: -1 | 1) => { if (!playlist) return; const ids = [...playlist.trackIds]; const index = ids.indexOf(trackId); const target = index + direction; if (index < 0 || target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; setPlaylists((items) => items.map((item) => item.id === playlist.id ? { ...item, trackIds: ids, updatedAt: Date.now() } : item)) }
  const removeTrack = (trackId: string) => { if (playlist) setPlaylists((items) => items.map((item) => item.id === playlist.id ? { ...item, trackIds: item.trackIds.filter((id) => id !== trackId), updatedAt: Date.now() } : item)) }
  const playlistTracks = playlist ? playlist.trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)) : []
  return <div className="view-content"><PageIntro eyebrow="CURATED BY YOU" title="Playlists" copy="Organize the sound of every moment." /><div className="playlist-layout"><div><div className="playlist-actions"><Button variant="primary" onClick={create}><Plus size={16} />New playlist</Button></div>{playlists.length ? playlists.map((item) => <button className={`playlist-row ${selected === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item.id)}><ListMusic size={17} /><span><strong>{item.name}</strong><small>{item.trackIds.length} tracks</small></span><ChevronDown size={16} /></button>) : <EmptyState type="playlist" onAction={create} />}</div>{playlist ? <div className="playlist-detail"><div className="detail-heading"><div><p className="eyebrow">PLAYLIST</p><h2>{playlist.name}</h2><p>{playlistTracks.length} tracks</p></div><div><Button onClick={addTrack}><Plus size={15} />Add track</Button><Button label="Rename playlist" onClick={rename}><Pencil size={16} /></Button><Button label="Delete playlist" onClick={remove}><Trash2 size={16} /></Button></div></div>{playlistTracks.length ? playlistTracks.map((track, index) => <div className="playlist-track-row" key={track.id}><CompactTrack track={track} onClick={() => play(track)} onFavorite={() => favorite(track.id)} /><div className="playlist-track-actions"><Button label="Move track up" onClick={() => updateTrackIds(track.id, -1)} disabled={index === 0}><ArrowLeft size={14} /></Button><Button label="Move track down" onClick={() => updateTrackIds(track.id, 1)} disabled={index === playlistTracks.length - 1}><ArrowRight size={14} /></Button><Button label="Remove track from playlist" onClick={() => removeTrack(track.id)}><X size={14} /></Button></div></div>) : <div className="playlist-empty"><ListMusic size={26} /><p>Add a track by title or artist.</p><Button variant="soft" onClick={addTrack}><Plus size={15} />Add track</Button></div>}</div> : <div className="playlist-detail playlist-placeholder"><ListMusic size={32} /><p>Select a playlist to see its tracks.</p></div>}</div></div>
}

function Player({ track, isPlaying, progress, duration, volume, muted, shuffle, repeat, onPlayPause, onPrevious, onNext, onSeek, onVolume, onMute, onShuffle, onRepeat, favorite, onQueue }: { track?: Track; isPlaying: boolean; progress: number; duration: number; volume: number; muted: boolean; shuffle: boolean; repeat: RepeatMode; onPlayPause: () => void; onPrevious: () => void; onNext: () => void; onSeek: (value: number) => void; onVolume: (value: number) => void; onMute: () => void; onShuffle: () => void; onRepeat: () => void; favorite: () => void; onQueue: () => void }) {
  return <footer className="player"><div className="now-playing">{track ? <><Artwork track={track} size="small" /><div className="now-meta"><strong>{track.title}</strong><span>{track.artist}</span></div><Button label="Add to favorites" className="player-heart" onClick={favorite}><Heart size={17} fill={track.favorite ? 'currentColor' : 'none'} /></Button></> : <div className="now-meta"><strong>Nothing playing</strong><span>Choose a track from your library</span></div>}</div><div className="player-center"><div className="player-controls"><Button label="Toggle shuffle" className={shuffle ? 'control-active' : ''} onClick={onShuffle}><Shuffle size={17} /></Button><Button label="Previous track" onClick={onPrevious}><ArrowLeft size={17} /></Button><button className="play-button" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!track} onClick={onPlayPause}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><Button label="Next track" onClick={onNext}><ArrowRight size={17} /></Button><Button label={`Repeat ${repeat}`} className={repeat !== 'off' ? 'control-active' : ''} onClick={onRepeat}><Repeat size={16} /></Button></div><div className="progress-row"><span>{formatTime(progress)}</span><input aria-label="Seek track" type="range" min="0" max={Math.max(duration, 0)} step=".1" value={Math.min(progress, duration || 0)} onChange={(e) => onSeek(Number(e.target.value))} /><span>{formatTime(duration)}</span></div></div><div className="player-volume"><button aria-label={muted ? 'Unmute' : 'Mute'} onClick={onMute}><Volume2 size={17} /></button><input aria-label="Volume" type="range" min="0" max="1" step=".01" value={muted ? 0 : volume} onChange={(e) => onVolume(Number(e.target.value))} /><Button label="Open queue" onClick={onQueue}><ListMusic size={17} /></Button></div></footer>
}

function QueuePanel({ queue, current, play, remove, move, clear, close }: { queue: Track[]; current?: Track; play: (track: Track) => void; remove: (id: string) => void; move: (id: string, direction: -1 | 1) => void; clear: () => void; close: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={close}><section className="queue-panel" role="dialog" aria-modal="true" aria-labelledby="queue-title" onMouseDown={(event) => event.stopPropagation()}><div className="queue-header"><div><p className="eyebrow">UP NEXT</p><h2 id="queue-title">Playback queue</h2></div><div><Button onClick={clear}><Trash2 size={15} />Clear</Button><Button label="Close queue" onClick={close}><X size={18} /></Button></div></div>{queue.length ? queue.map((track, index) => <div className={`queue-row ${current?.id === track.id ? 'active' : ''}`} key={track.id}><button onClick={() => play(track)}><Artwork track={track} size="small" /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button><span className="muted">{formatTime(track.duration)}</span><div className="queue-actions"><Button label="Move up" disabled={index === 0} onClick={() => move(track.id, -1)}><ArrowLeft size={13} /></Button><Button label="Move down" disabled={index === queue.length - 1} onClick={() => move(track.id, 1)}><ArrowRight size={13} /></Button><Button label={`Remove ${track.title} from queue`} onClick={() => remove(track.id)}><X size={15} /></Button></div></div>) : <div className="playlist-empty"><ListMusic size={25} /><p>Add tracks from your Library to build a queue.</p></div>}</section></div>
}

function ImportDialog({ close, onFiles, error }: { close: () => void; onFiles: (files: FileList | File[]) => void; error?: string }) {
  const onDrop = (event: React.DragEvent) => { event.preventDefault(); onFiles(event.dataTransfer.files) }
  return <div className="dialog-backdrop" onMouseDown={close}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(e) => e.stopPropagation()}><button className="dialog-close" onClick={close} aria-label="Close"><X size={18} /></button><div className="dialog-icon"><Upload size={25} /></div><p className="eyebrow">BUILD YOUR LIBRARY</p><h2 id="dialog-title">Bring your music in.</h2><p>ROGUE plays the files already on your device. Choose audio files or drop them here.</p><label className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}><input type="file" accept="audio/*,.flac,.wav,.m4a,.ogg,.opus" multiple onChange={(e) => e.target.files && onFiles(e.target.files)} /><FileAudio size={27} /><strong>Choose audio files</strong><span>MP3, WAV, FLAC, M4A and more · drag and drop supported</span></label>{error && <p className="import-error">{error}</p>}<p className="dialog-note"><Check size={14} /> Files stay on your device. Always.</p></div></div>
}

function SettingsView({ volume, setVolume }: { volume: number; setVolume: (value: number) => void }) { return <div className="view-content"><PageIntro eyebrow="PREFERENCES" title="Settings" copy="Tune ROGUE to feel like yours." /><div className="settings-list"><div className="setting"><div className="setting-icon"><Volume2 size={18} /></div><div><strong>Default volume</strong><p>Saved locally for your next session</p></div><input className="setting-range" type="range" min="0" max="1" step=".01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></div><div className="setting"><div className="setting-icon"><Zap size={18} /></div><div><strong>Storage</strong><p>Audio files are kept in IndexedDB when supported by your browser.</p></div></div></div><div className="settings-footer">ROGUE <span>v0.2.0 · Built for your local frequency</span></div></div> }

export default function App() {
  const [view, setView] = useState<View>('Home')
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [current, setCurrent] = useState<Track>()
  const [queue, setQueue] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(.8)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [queueOpen, setQueueOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [statusMessage, setStatusMessage] = useState('')
  const historyRef = useRef<Array<{ view: View; filter: string }>>([{ view: 'Home', filter: '' }])
  const historyIndexRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const objectUrlRef = useRef('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadState()
      .then((state) => {
        setTracks(state.tracks)
        setPlaylists(state.playlists)
        setRecentIds(state.recentTrackIds)
        setVolume(state.volume)
      })
      .catch(() => setImportError('Local storage is unavailable. Your library will only last for this session.'))
      .finally(() => setReady(true))
  }, [])
  useEffect(() => { if (!ready) return; saveTrackMetadata(tracks).catch((error) => setImportError(storageErrorMessage(error))) }, [ready, tracks])
  useEffect(() => { if (!ready) return; savePreferences(recentIds, volume).catch(() => undefined) }, [ready, recentIds, volume])
  useEffect(() => { if (!ready) return; savePlaylists(playlists).catch(() => undefined) }, [ready, playlists])
  useEffect(() => { const audio = audioRef.current; const update = () => { setProgress(audio.currentTime); setDuration(Number.isFinite(audio.duration) ? audio.duration : current?.duration ?? 0) }; const ended = () => { const following = nextTrack(current?.id, queue.length ? queue : tracks, shuffle, repeat); if (following) play(following); else setIsPlaying(false) }; const failed = () => { setIsPlaying(false); setStatusMessage(`This audio file is unavailable or cannot be decoded: ${current?.fileName ?? 'unknown file'}.`) }; audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', update); audio.addEventListener('ended', ended); audio.addEventListener('error', failed); return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('loadedmetadata', update); audio.removeEventListener('ended', ended); audio.removeEventListener('error', failed) } }, [current?.id, queue, tracks, shuffle, repeat])
  useEffect(() => () => { audioRef.current.pause(); URL.revokeObjectURL(objectUrlRef.current) }, [])
  useEffect(() => { audioRef.current.volume = muted ? 0 : volume }, [volume, muted])
  useEffect(() => { const online = () => setOnline(true); const offline = () => setOnline(false); window.addEventListener('online', online); window.addEventListener('offline', offline); return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) } }, [])
  const play = useCallback((track: Track) => {
    if (!track.file || track.file.size === 0) {
      setIsPlaying(false)
      setStatusMessage(`This audio file is no longer stored locally. Import "${track.fileName}" again to play it.`)
      return
    }
    const audio = audioRef.current
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = URL.createObjectURL(track.file)
    audio.src = objectUrlRef.current
    audio.volume = muted ? 0 : volume
    setCurrent(track)
    setProgress(0)
    setDuration(track.duration)
    setIsPlaying(true)
    audio.play().catch(() => setIsPlaying(false))
    setRecentIds((ids) => [track.id, ...ids.filter((id) => id !== track.id)].slice(0, 12))
    setTracks((items) => items.map((item) => item.id === track.id ? { ...item, lastPlayedAt: Date.now() } : item))
  }, [muted, volume])
  const togglePlay = () => { if (!current) return; if (audioRef.current.paused) { audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)) } else { audioRef.current.pause(); setIsPlaying(false) } }
  const next = () => { const following = nextTrack(current?.id, queue.length ? queue : tracks, shuffle, repeat === 'one' ? 'all' : repeat); if (following) play(following) }
  const previous = () => { const following = previousTrack(current?.id, queue.length ? queue : tracks); if (following) play(following) }
  const toggleFavorite = (id: string) => setTracks((items) => items.map((track) => track.id === id ? { ...track, favorite: !track.favorite } : track))
  const importFiles = async (files: FileList | File[]) => {
    setImportError('')
    const incoming = Array.from(files)
    const valid = incoming.filter(isSupportedAudio)
    if (valid.length !== incoming.length) setImportError('Some files were skipped because they are not supported audio files.')
    const existing = new Set(tracks.map((track) => `${track.fileName}:${track.file.size}`))
    const nextTracks: Track[] = []
    for (const file of valid) {
      if (existing.has(`${file.name}:${file.size}`)) continue
      try { const track = await readTrack(file); nextTracks.push(track) }
      catch { setImportError((message) => `${message ? `${message} ` : ''}Could not read ${file.name}.`) }
    }
    if (!nextTracks.length) return
    setTracks((items) => [...items, ...nextTracks])
    try {
      await saveTracks(nextTracks)
      setDialogOpen(false)
      setView('Library')
    } catch (error) {
      setImportError(storageErrorMessage(error))
    }
  }
  const remove = async (id: string) => { if (current?.id === id) { audioRef.current.pause(); setCurrent(undefined); setIsPlaying(false) } setTracks((items) => items.filter((track) => track.id !== id)); setQueue((items) => items.filter((track) => track.id !== id)); setRecentIds((ids) => ids.filter((item) => item !== id)); await removeTrack(id).catch(() => setImportError('Could not remove this track from local storage.')) }
  const recent = recentIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track))
  const navigate = useCallback((nextView: View, nextFilter = '') => {
    const currentEntry = historyRef.current[historyIndexRef.current]
    if (currentEntry?.view === nextView && currentEntry.filter === nextFilter) return
    historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), { view: nextView, filter: nextFilter }]
    historyIndexRef.current += 1
    setView(nextView)
    setFilter(nextFilter)
  }, [])
  const goBack = () => {
    if (historyIndexRef.current === 0) return
    historyIndexRef.current -= 1
    const entry = historyRef.current[historyIndexRef.current]
    setView(entry.view)
    setFilter(entry.filter)
  }
  const goForward = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const entry = historyRef.current[historyIndexRef.current]
    setView(entry.view)
    setFilter(entry.filter)
  }
  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: current.album })
    navigator.mediaSession.setActionHandler('play', () => { audioRef.current.play().then(() => setIsPlaying(true)).catch(() => undefined) })
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current.pause(); setIsPlaying(false) })
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
    return () => { navigator.mediaSession.metadata = null; ['play', 'pause', 'nexttrack', 'previoustrack'].forEach((action) => navigator.mediaSession.setActionHandler(action as MediaSessionAction, null)) }
  }, [current?.id, next, previous])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === 'INPUT' || (event.target as HTMLElement).tagName === 'TEXTAREA') { if (event.key === 'Escape') setDialogOpen(false); return }
      if (event.key === ' ') { event.preventDefault(); togglePlay() }
      if (event.key === 'ArrowRight' && current) { audioRef.current.currentTime = Math.min(audioRef.current.duration || duration, audioRef.current.currentTime + 5) }
      if (event.key === 'ArrowLeft' && current) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5) }
      if (event.key.toLowerCase() === 'n') next()
      if (event.key.toLowerCase() === 'p') previous()
      if (event.key === 'Escape') { setDialogOpen(false); setQueueOpen(false) }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [current, duration, next, previous, togglePlay])
  const content = view === 'Home' ? <HomeView tracks={tracks} recent={recent} setView={navigate} onImport={() => setDialogOpen(true)} play={play} favorite={toggleFavorite} /> : view === 'Library' ? <LibraryView tracks={tracks} filter={filter} setFilter={setFilter} play={play} favorite={toggleFavorite} remove={remove} onImport={() => { setDialogOpen(true); navigate('Library') }} addQueue={(track) => setQueue((items) => items.some((item) => item.id === track.id) ? items : [...items, track])} /> : view === 'Favorites' ? <div className="view-content"><PageIntro eyebrow="YOUR PICKS" title="Favorites" copy="The ones you keep coming back to." /><div className="track-grid">{tracks.filter((track) => track.favorite).map((track) => <TrackCard key={track.id} track={track} onClick={() => play(track)} onFavorite={() => toggleFavorite(track.id)} />)}</div>{!tracks.some((track) => track.favorite) && <EmptyState type="search" message="Favorite tracks will show up here." />}</div> : view === 'Playlists' ? <PlaylistsView playlists={playlists} tracks={tracks} setPlaylists={setPlaylists} play={play} favorite={toggleFavorite} /> : <SettingsView volume={volume} setVolume={setVolume} />
  const moveQueue = (id: string, direction: -1 | 1) => setQueue((items) => { const index = items.findIndex((item) => item.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= items.length) return items; const nextQueue = [...items]; [nextQueue[index], nextQueue[target]] = [nextQueue[target], nextQueue[index]]; return nextQueue })
  return <div className="app-shell">{(!online || statusMessage || importError) && <div className="status-banner">{!online ? 'Offline mode: the app shell remains available. Original files may require re-selection if storage is unavailable.' : statusMessage || importError}<button onClick={() => { setStatusMessage(''); setImportError('') }} aria-label="Dismiss message"><X size={14} /></button></div>}<Sidebar view={view} setView={(nextView) => navigate(nextView)} onImport={() => { setDialogOpen(true); navigate('Library') }} favoriteCount={tracks.filter((track) => track.favorite).length} /><main className="main"><Header view={view} filter={filter} setView={navigate} onImport={() => { setDialogOpen(true); navigate('Library') }} onSearch={(value) => { setFilter(value); if (value && view !== 'Library') navigate('Library', value) }} onBack={goBack} onForward={goForward} canGoBack={historyIndexRef.current > 0} canGoForward={historyIndexRef.current < historyRef.current.length - 1} /><div className="mobile-scroll">{content}</div></main><Player track={current} isPlaying={isPlaying} progress={progress} duration={duration} volume={volume} muted={muted} shuffle={shuffle} repeat={repeat} onPlayPause={togglePlay} onPrevious={previous} onNext={next} onSeek={(value) => { audioRef.current.currentTime = value; setProgress(value) }} onVolume={(value) => { setVolume(value); setMuted(false) }} onMute={() => setMuted((value) => !value)} onShuffle={() => setShuffle((value) => !value)} onRepeat={() => setRepeat((value) => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off')} favorite={() => current && toggleFavorite(current.id)} onQueue={() => setQueueOpen(true)} />{dialogOpen && <ImportDialog close={() => setDialogOpen(false)} onFiles={importFiles} error={importError} />}{queueOpen && <QueuePanel queue={queue} current={current} play={play} remove={(id) => setQueue((items) => items.filter((item) => item.id !== id))} move={moveQueue} clear={() => setQueue([])} close={() => setQueueOpen(false)} />}</div>
}
