"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  FileText, 
  BarChart3, 
  Download, 
  Loader2, 
  Play, 
  Clock,
  TrendingUp,
  Zap,
  Building2,
  Cpu,
  BookOpen,
  Eye,
  EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3000/api/v1" : "/api/v1"

interface Report {
  id: string
  query: string
  type: string
  title?: string
  content: string
  timestamp: string
  status: 'generating' | 'completed' | 'failed'
  error?: string
  wordCount?: number
  sources?: number
  duration?: number
  currentStage?: string
  progress?: number
  metadata?: {
    generatedBy?: string
    researchStages?: number
    searchQueries?: number
    contentExtracted?: boolean
    aiAnalyzed?: boolean
    totalWords?: number
    uniqueDomains?: number
    averageRelevanceScore?: number
  }
  researchPlan?: {
    originalQuery?: string
    refinedQueries?: string[]
    analysisFramework?: string
    focusAreas?: string[]
  }
}

export default function ReportsPage() {
  const [query, setQuery] = useState("")
  const [reportType, setReportType] = useState("comprehensive")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reports, setReports] = useState<Report[]>([])
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set())

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")

    const newReport: Report = {
      id: Date.now().toString(),
      query: query.trim(),
      type: reportType,
      content: "",
      timestamp: new Date().toISOString(),
      status: 'generating',
      currentStage: 'Initializing Advanced AI Research...',
      progress: 0
    }

    setReports(prev => [newReport, ...prev])
    
    // Simulate progress updates (since we can't get real-time progress from backend)
    const stages = [
      { stage: 'Analyzing query and creating research plan...', progress: 15 },
      { stage: 'Conducting comprehensive web research...', progress: 40 },
      { stage: 'Extracting and analyzing content...', progress: 65 },
      { stage: 'Prioritizing sources and insights...', progress: 80 },
      { stage: 'Synthesizing comprehensive report...', progress: 95 }
    ]
    
    let stageIndex = 0
    const progressInterval = setInterval(() => {
      if (stageIndex < stages.length) {
        const currentStageInfo = stages[stageIndex]
        setReports(prev => prev.map(report => 
          report.id === newReport.id && report.status === 'generating'
            ? { 
                ...report, 
                currentStage: currentStageInfo.stage,
                progress: currentStageInfo.progress
              }
            : report
        ))
        stageIndex++
      }
    }, 3000) // Update every 3 seconds

    try {
      const response = await fetch(`${API_BASE}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: query.trim(),
          type: reportType
        }),
      })

      if (!response.ok) throw new Error("Report generation failed")

      const data = await response.json()
      
      clearInterval(progressInterval)
      
      if (data.success && data.report) {
        // Update the report with comprehensive data
        setReports(prev => prev.map(report => 
          report.id === newReport.id 
            ? { 
                ...report, 
                content: data.report.content || data.report, 
                title: data.report.title,
                status: 'completed' as const,
                currentStage: 'Report completed!',
                progress: 100,
                wordCount: data.report.wordCount,
                sources: data.report.sources,
                duration: data.report.duration,
                metadata: data.report.metadata,
                researchPlan: data.report.researchPlan
              }
            : report
        ))
        setQuery("")
      } else {
        throw new Error(data.error || "Advanced report generation failed")
      }
    } catch (err: unknown) {
      clearInterval(progressInterval)
      const errorMessage = err instanceof Error ? err.message : "Advanced report generation failed"
      setError(errorMessage)
      // Update the report with error
      setReports(prev => prev.map(report => 
        report.id === newReport.id 
          ? { 
              ...report, 
              error: errorMessage, 
              status: 'failed' as const,
              currentStage: 'Generation failed',
              progress: 0
            }
          : report
      ))
    } finally {
      setLoading(false)
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'comprehensive': return <FileText className="w-4 h-4" />
      case 'business': return <Building2 className="w-4 h-4" />
      case 'technical': return <Cpu className="w-4 h-4" />
      case 'research': return <BookOpen className="w-4 h-4" />
      case 'general': return <FileText className="w-4 h-4" />
      case 'stock_news': return <TrendingUp className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getReportTypeName = (type: string) => {
    switch (type) {
      case 'comprehensive': return 'Comprehensive'
      case 'business': return 'Business Analysis'
      case 'technical': return 'Technical Analysis'
      case 'research': return 'Research Report'
      case 'general': return 'General Analysis'
      case 'stock_news': return 'Stock News'
      default: return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const toggleReportExpansion = (reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reportId)) {
        newSet.delete(reportId)
      } else {
        newSet.add(reportId)
      }
      return newSet
    })
  }

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'generating': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'completed': return <FileText className="w-4 h-4 text-green-500" />
      case 'generating': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'failed': return <Alert className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getProgressBar = (progress: number = 0) => (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div 
        className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  )

  const downloadReport = (report: Report) => {
    const reportContent = `${report.title || `${getReportTypeName(report.type)}: ${report.query}`}\n\n${report.content}`
    const blob = new Blob([reportContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.query.replace(/[^a-zA-Z0-9]/g, '-')}-${report.type}-${new Date(report.timestamp).toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex justify-between items-center p-6"
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Web Crawler AI
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-8">
            <nav className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-purple-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/search" className="text-gray-600 hover:text-purple-600 transition-colors">
                Search
              </Link>
              <Link href="/reports" className="text-gray-600 hover:text-purple-600 transition-colors">
                Reports
              </Link>
            </nav>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="relative z-10 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-gray-900 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Reports
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Advanced AI Research Agent with multi-stage analysis, intelligent content prioritization, and comprehensive report synthesis
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Report Generator */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-1"
              >
                <Card className="bg-white border-gray-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">Generate Report</h2>
                    </div>

                    <form onSubmit={handleGenerateReport} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Query
                        </label>
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="e.g., quantum computing developments, renewable energy market analysis, AI in healthcare"
                          className="w-full"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          AI will analyze your query and create targeted research strategies
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Report Type
                        </label>
                        <select
                          value={reportType}
                          onChange={(e) => setReportType(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        >
                          <option value="comprehensive">🔬 Comprehensive Research</option>
                          <option value="business">💼 Business Analysis</option>
                          <option value="technical">⚙️ Technical Analysis</option>
                          <option value="research">📑 Academic Research</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Advanced AI research with multi-query analysis and content prioritization
                        </p>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Play className="w-5 h-5 mr-2" />
                        )}
                        Generate Report
                      </Button>
                    </form>

                    {error && (
                      <Alert className="mt-4 border-red-200 bg-red-50">
                        <AlertDescription className="text-red-800">{error}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Reports List */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-2"
              >
                <Card className="bg-white border-gray-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">Recent Reports</h2>
                    </div>

                    {reports.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No reports generated yet. Create your first report above!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reports.map((report) => (
                          <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(report.status)}
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900">
                                    {report.title || `${getReportTypeName(report.type)}: ${report.query}`}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge className={getStatusColor(report.status)}>
                                      {report.status}
                                    </Badge>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                      {getReportTypeIcon(report.type)}
                                      {getReportTypeName(report.type)}
                                    </Badge>
                                    {report.wordCount && (
                                      <Badge variant="secondary">
                                        {report.wordCount.toLocaleString()} words
                                      </Badge>
                                    )}
                                    {report.sources && (
                                      <Badge variant="secondary">
                                        {report.sources} sources
                                      </Badge>
                                    )}
                                    {report.duration && (
                                      <Badge variant="secondary">
                                        {report.duration}s
                                      </Badge>
                                    )}
                                    {report.metadata?.averageRelevanceScore && (
                                      <Badge variant="secondary">
                                        {report.metadata.averageRelevanceScore.toFixed(1)}/10 relevance
                                      </Badge>
                                    )}
                                    {report.metadata?.searchQueries && (
                                      <Badge variant="secondary">
                                        {report.metadata.searchQueries} queries
                                      </Badge>
                                    )}
                                    <span className="text-sm text-gray-500">
                                      {new Date(report.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {report.status === 'completed' && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleReportExpansion(report.id)}
                                        >
                                          {expandedReports.has(report.id) ? (
                                            <EyeOff className="w-4 h-4" />
                                          ) : (
                                            <Eye className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{expandedReports.has(report.id) ? 'Hide' : 'Show'} Report</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => downloadReport(report)}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download as Markdown</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </div>

                            {report.status === 'completed' && report.content && expandedReports.has(report.id) && (
                              <div className="bg-gray-50 rounded-md p-4 mt-3">
                                <div className="prose prose-gray max-w-none text-sm">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      h1: ({ children }) => (
                                        <h1 className="text-xl font-bold text-gray-900 mt-6 mb-4 first:mt-0">
                                          {children}
                                        </h1>
                                      ),
                                      h2: ({ children }) => (
                                        <h2 className="text-lg font-semibold text-gray-900 mt-5 mb-3 first:mt-0">
                                          {children}
                                        </h2>
                                      ),
                                      h3: ({ children }) => (
                                        <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">
                                          {children}
                                        </h3>
                                      ),
                                      p: ({ children }) => (
                                        <p className="mb-3 text-gray-700 leading-relaxed">
                                          {children}
                                        </p>
                                      ),
                                      ul: ({ children }) => (
                                        <ul className="mb-3 space-y-1 list-disc list-inside text-gray-700 ml-4">
                                          {children}
                                        </ul>
                                      ),
                                      ol: ({ children }) => (
                                        <ol className="mb-3 space-y-1 list-decimal list-inside text-gray-700 ml-4">
                                          {children}
                                        </ol>
                                      ),
                                      li: ({ children }) => (
                                        <li className="leading-relaxed">
                                          {children}
                                        </li>
                                      ),
                                      strong: ({ children }) => (
                                        <strong className="font-semibold text-gray-900">
                                          {children}
                                        </strong>
                                      ),
                                      em: ({ children }) => (
                                        <em className="italic text-gray-800">
                                          {children}
                                        </em>
                                      ),
                                      code: ({ children }) => (
                                        <code className="bg-purple-100 text-purple-700 px-1 py-0.5 rounded text-xs font-mono">
                                          {children}
                                        </code>
                                      ),
                                      blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-purple-200 pl-4 italic text-gray-600 my-3">
                                          {children}
                                        </blockquote>
                                      ),
                                      table: ({ children }) => (
                                        <div className="overflow-x-auto my-3">
                                          <table className="min-w-full border border-gray-200 rounded-lg">
                                            {children}
                                          </table>
                                        </div>
                                      ),
                                      th: ({ children }) => (
                                        <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-900">
                                          {children}
                                        </th>
                                      ),
                                      td: ({ children }) => (
                                        <td className="border border-gray-200 px-3 py-2 text-gray-700">
                                          {children}
                                        </td>
                                      ),
                                      hr: () => (
                                        <hr className="border-gray-300 my-4" />
                                      )
                                    }}
                                  >
                                    {report.content}
                                  </ReactMarkdown>
                                </div>
                                
                                {report.metadata && (
                                  <div className="mt-4 pt-3 border-t border-gray-200">
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                      {report.metadata.aiGenerated && (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                          🤖 AI Generated
                                        </span>
                                      )}
                                      {report.metadata.contentExtraction && (
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                          🔍 Content Extracted
                                        </span>
                                      )}
                                      {report.metadata.totalWords && (
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                          {report.metadata.totalWords.toLocaleString()} words processed
                                        </span>
                                      )}
                                      {report.metadata.uniqueDomains && (
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                          {report.metadata.uniqueDomains} domains
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Progress indicator for generating reports */}
                            {report.status === 'generating' && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-md">
                                <div className="flex items-center gap-2 mb-2">
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                  <span className="text-sm font-medium text-blue-700">
                                    {report.currentStage || 'Processing...'}
                                  </span>
                                </div>
                                {getProgressBar(report.progress)}
                                <p className="text-xs text-blue-600 mt-2">
                                  Advanced AI research in progress - this may take 30-60 seconds
                                </p>
                              </div>
                            )}
                            
                            {/* Research plan preview */}
                            {report.status === 'completed' && report.researchPlan && !expandedReports.has(report.id) && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-700">Research Strategy</span>
                                </div>
                                {report.researchPlan.focusAreas && (
                                  <div className="mb-2">
                                    <p className="text-xs text-gray-600 mb-1">Focus Areas:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {report.researchPlan.focusAreas.slice(0, 4).map((area, idx) => (
                                        <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                          {area}
                                        </span>
                                      ))}
                                      {report.researchPlan.focusAreas.length > 4 && (
                                        <span className="text-xs text-gray-500">+{report.researchPlan.focusAreas.length - 4} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <p className="text-xs text-gray-600">
                                  Click the eye icon to view the comprehensive report
                                </p>
                              </div>
                            )}
                            
                            {report.status === 'completed' && report.content && !expandedReports.has(report.id) && !report.researchPlan && (
                              <div className="mt-3">
                                <p className="text-sm text-gray-600">
                                  Advanced report generated successfully. Click the eye icon to view the full content.
                                </p>
                              </div>
                            )}

                            {report.status === 'failed' && report.error && (
                              <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
                                <p className="text-sm text-red-700">
                                  Error: {report.error}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
} 