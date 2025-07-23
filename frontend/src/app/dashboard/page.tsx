"use client"

import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  Globe, 
  Loader2, 
  Play, 
  Settings, 
  BarChart3,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"

const API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3000/api/v1" : "/api/v1"

interface CrawlJob {
  id: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  pagesCrawled: number
  totalPages: number
  startTime: string
  endTime?: string
  error?: string
}

export default function DashboardPage() {
  const [url, setUrl] = useState("")
  const [maxDepth, setMaxDepth] = useState(2)
  const [followLinks, setFollowLinks] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([])

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url, 
          maxDepth, 
          followLinks 
        }),
      })

      if (!response.ok) throw new Error("Crawl failed")

      const data = await response.json()
      
      if (data.success) {
        // Add new crawl job to the list with real data
        const newJob: CrawlJob = {
          id: Date.now().toString(),
          url,
          status: 'completed',
          progress: 100,
          pagesCrawled: data.stats?.totalCompleted || data.stats?.totalPages || 0,
          totalPages: data.stats?.totalUrls || data.stats?.totalPages || 0,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        }
        setCrawlJobs(prev => [newJob, ...prev])
        setUrl("")
      } else {
        throw new Error(data.error || "Crawl failed")
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Crawl failed"
      setError(errorMessage)
      
      // Add failed job to the list
      const failedJob: CrawlJob = {
        id: Date.now().toString(),
        url,
        status: 'failed',
        progress: 0,
        pagesCrawled: 0,
        totalPages: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        error: errorMessage
      }
      setCrawlJobs(prev => [failedJob, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: CrawlJob['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: CrawlJob['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
                Crawl Dashboard
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Manage your web crawling jobs and monitor progress in real-time
              </p>
            </motion.div>

            {/* Crawl Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <Card className="bg-white border-gray-200 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    <h2 className="text-xl font-bold text-gray-900">Crawl Statistics</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {crawlJobs.filter(job => job.status === 'completed').length}
                      </div>
                      <div className="text-sm text-gray-600">Completed Jobs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {crawlJobs.reduce((sum, job) => sum + job.pagesCrawled, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Pages</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {crawlJobs.reduce((sum, job) => sum + job.totalPages, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total URLs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {crawlJobs.filter(job => job.status === 'failed').length}
                      </div>
                      <div className="text-sm text-gray-600">Failed Jobs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Crawl Form */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-1"
              >
                <Card className="bg-white border-gray-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Settings className="w-5 h-5 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">New Crawl Job</h2>
                    </div>

                    <form onSubmit={handleCrawl} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          URL to Crawl
                        </label>
                        <Input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Depth
                        </label>
                        <Input
                          type="number"
                          value={maxDepth}
                          onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                          min="1"
                          max="5"
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={followLinks}
                          onCheckedChange={setFollowLinks}
                        />
                        <label className="text-sm font-medium text-gray-700">
                          Follow Links
                        </label>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Play className="w-5 h-5 mr-2" />
                        )}
                        Start Crawl
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

              {/* Crawl Jobs List */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="lg:col-span-2"
              >
                <Card className="bg-white border-gray-200 shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Globe className="w-5 h-5 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">Recent Crawl Jobs</h2>
                    </div>

                    {crawlJobs.length === 0 ? (
                      <div className="text-center py-8">
                        <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No crawl jobs yet. Start your first crawl above!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {crawlJobs.map((job) => (
                          <motion.div
                            key={job.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              {getStatusIcon(job.status)}
                              <div>
                                <p className="font-medium text-gray-900 truncate max-w-xs">
                                  {job.url}
                                </p>
                                <div className="flex items-center gap-4 mt-1">
                                  <Badge className={getStatusColor(job.status)}>
                                    {job.status}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {job.pagesCrawled} / {job.totalPages} pages
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {new Date(job.startTime).toLocaleTimeString()}
                                  </span>
                                </div>
                                {job.error && (
                                  <p className="text-sm text-red-600 mt-1">
                                    Error: {job.error}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {job.status === 'completed' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(job.url, '_blank')}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Open URL</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
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