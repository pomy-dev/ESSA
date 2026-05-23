'use client'
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { X, Printer, Star, CheckCircle, XCircle } from 'lucide-react'
import Button from '../../components/ui/Button'
import QRCode from 'qrcode'

interface Player {
  id: string
  first_name: string
  last_name: string
  student_id: string
  grade: string
  enrollment_year: number
  is_verified: boolean
}

interface SquadPlayer {
  id: string
  player_id: string
  position: string
  jersey_number: number | null
  is_captain: boolean
  school_verified: boolean
  players: Player
}

interface Match {
  id: string
  match_date: string
  venue: string
  match_number: number | null
  draws: { id: string; title: string; sport: string; stage: number; season: string }
  home_school: { id: string; name: string; code: string }
  away_school: { id: string; name: string; code: string }
}

interface Props {
  match: Match
  squadPlayers: SquadPlayer[]
  schoolId: string
  teacherName: string
  barcode: string
  onClose: () => void
}

export default function SquadPrintView({ match, squadPlayers, schoolId, teacherName, barcode, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const refereeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/referee/${barcode}`

  useEffect(() => {
    QRCode.toDataURL(refereeUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [refereeUrl])

  function handlePrint() {
    window.print()
  }

  const mySchool = match.home_school.id === schoolId ? match.home_school : match.away_school
  const opponent = match.home_school.id === schoolId ? match.away_school : match.home_school
  const role = match.home_school.id === schoolId ? 'Home' : 'Away'

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Toolbar - hidden when printing */}
      <div className="no-print sticky top-0 bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="font-semibold">Squad Print Preview</div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <Printer size={16} /> Print
          </Button>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="max-w-3xl mx-auto p-8 print:p-4">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
          <div className="text-3xl font-bold text-slate-900 uppercase tracking-wide">ESSA</div>
          <div className="text-lg text-slate-600">Eswatini Schools Association</div>
          <div className="text-base font-semibold text-slate-800 mt-1">Official Match Squad List</div>
        </div>

        {/* Match Details */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <table className="text-sm w-full">
              <tbody>
                <tr><td className="text-slate-500 pr-4 py-0.5">Draw</td><td className="font-medium">{match.draws.title}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Sport</td><td className="font-medium">{match.draws.sport}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Stage</td><td className="font-medium">Stage {match.draws.stage} — {match.draws.season}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Date</td><td className="font-medium">{format(new Date(match.match_date), 'EEEE, dd MMMM yyyy')}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Time</td><td className="font-medium">{format(new Date(match.match_date), 'HH:mm')}</td></tr>
                {match.venue && <tr><td className="text-slate-500 pr-4 py-0.5">Venue</td><td className="font-medium">{match.venue}</td></tr>}
                {match.match_number && <tr><td className="text-slate-500 pr-4 py-0.5">Match #</td><td className="font-medium">{match.match_number}</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <table className="text-sm w-full">
              <tbody>
                <tr><td className="text-slate-500 pr-4 py-0.5">Our School</td><td className="font-semibold text-blue-800">{mySchool.name}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">School Code</td><td className="font-mono">{mySchool.code}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Opponent</td><td className="font-medium">{opponent.name} ({opponent.code})</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Role</td><td className="font-medium">{role}</td></tr>
                <tr><td className="text-slate-500 pr-4 py-0.5">Coach / Teacher</td><td className="font-medium">{teacherName}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Players table */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Player Name</th>
              <th className="text-left px-3 py-2">Student ID</th>
              <th className="text-left px-3 py-2">Grade</th>
              <th className="text-left px-3 py-2">Year</th>
              <th className="text-left px-3 py-2">Position</th>
              <th className="text-left px-3 py-2 w-20">Verified</th>
            </tr>
          </thead>
          <tbody>
            {squadPlayers.map((sp, idx) => (
              <tr key={sp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-3 py-2 font-mono text-slate-600">{sp.jersey_number ?? idx + 1}</td>
                <td className="px-3 py-2 font-medium">
                  {sp.players.first_name} {sp.players.last_name}
                  {sp.is_captain && <span className="ml-1 text-amber-500 text-xs font-bold">(C)</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{sp.players.student_id}</td>
                <td className="px-3 py-2 text-slate-600">{sp.players.grade}</td>
                <td className="px-3 py-2 text-slate-600">{sp.players.enrollment_year}</td>
                <td className="px-3 py-2 text-slate-600">{sp.position}</td>
                <td className="px-3 py-2">
                  {sp.school_verified
                    ? <span className="text-green-600 font-semibold text-xs">YES</span>
                    : <span className="text-red-500 font-semibold text-xs">NO</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* QR Code */}
        <div className="flex items-start gap-6 border-t border-slate-200 pt-6">
          <div>
            {qrDataUrl && <img src={qrDataUrl} alt="Squad QR Code" className="w-32 h-32" />}
            <div className="text-xs text-slate-500 mt-1 text-center">Scan for verification</div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-700 mb-1">Referee Verification</div>
            <p className="text-xs text-slate-500">
              Scan the QR code to verify this squad list on the ESSA system. The referee should check
              each player on this list against the system record before the match begins.
            </p>
            <div className="mt-2 text-xs font-mono text-slate-400 break-all">{barcode}</div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="text-xs text-slate-500 mb-1">Official Signature</div>
              <div className="border-b border-slate-400 w-48 mt-6" />
              <div className="text-xs text-slate-500 mt-1">{teacherName} — Coach / Teacher</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Legend</div>
            <div className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={10} /> Verified student</div>
            <div className="flex items-center gap-1 text-xs text-red-500"><XCircle size={10} /> Not verified</div>
            <div className="flex items-center gap-1 text-xs text-amber-500"><Star size={10} className="fill-amber-500" /> Captain</div>
          </div>
        </div>

        {/* Printed date */}
        <div className="text-xs text-slate-400 text-center mt-6">
          Printed: {format(new Date(), 'dd MMM yyyy HH:mm')} · ESSA Sports Management System
        </div>
      </div>
    </div>
  )
}
