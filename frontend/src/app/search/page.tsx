"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search, Sparkles, Loader2, ExternalLink, Filter, SortAsc, SortDesc, ChevronDown, ChevronUp } from "lucide-react"
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

interface SearchResult {
  id: string
  url: string
  title: string
  content: string
  score: number
  timestamp: string
  domain: string
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sortBy, setSortBy] = useState<"relevance" | "date">("relevance")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [summary, setSummary] = useState("")
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: query.trim(),
          limit: 20,
          enableContentExtraction: true
        }),
      })

      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      
      // Debug logging
      console.log('Search API response:', data);
      console.log('First result:', data.results?.[0]);
      
      if (data.results) {
        // Transform the results to match our interface
        const transformedResults: SearchResult[] = data.results.map((result: Record<string, unknown>, index: number) => {
          // Ensure we get content from the right field
          const content = (result.content as string) || (result.snippet as string) || (result.text as string) || "No content available";
          
          return {
            id: (result.id as string) || index.toString(),
            url: (result.url as string) || (result.link as string) || "",
            title: (result.title as string) || "No Title",
            content: content,
            score: (result.score as number) || (result.relevance as number) || 0,
            timestamp: (result.timestamp as string) || new Date().toISOString(),
            domain: (result.domain as string) || new URL((result.url as string) || (result.link as string) || "http://example.com").hostname
          };
        })
        
        setResults(transformedResults)
        setSummary(data.summary || "")
      } else {
        setResults([])
        setSummary("")
        if (data.results && data.results.length === 0) {
          setError("No results found for your query.")
        } else {
          throw new Error(data.error || "Search failed")
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Search failed"
      setError(errorMessage)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const formatText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  const truncateSummary = (text: string, maxLength: number = 500) => {
    if (!text || text.length <= maxLength) return text
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength)
    const lastSentence = truncated.lastIndexOf('.')
    if (lastSentence > maxLength * 0.7) {
      return text.substring(0, lastSentence + 1)
    }
    return truncated + "..."
  }

  const shouldShowExpandButton = (text: string) => {
    return text && text.length > 500
  }

  const getDomainColor = (domain: string) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800", 
      "bg-purple-100 text-purple-800",
      "bg-orange-100 text-orange-800",
      "bg-red-100 text-red-800",
      "bg-indigo-100 text-indigo-800"
    ]
    const hash = domain.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === "relevance") {
      return sortOrder === "desc" ? b.score - a.score : a.score - b.score
    } else {
      const dateA = new Date(a.timestamp).getTime()
      const dateB = new Date(b.timestamp).getTime()
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB
    }
  })

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
                Search Content
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Search through all crawled content with AI-powered relevance
              </p>
            </motion.div>

            {/* Search Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <Card className="bg-white border-gray-200 shadow-xl">
                <CardContent className="p-6">
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search for anything..."
                          className="w-full text-lg"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Search className="w-5 h-5 mr-2" />
                        )}
                        Search
                      </Button>
                    </div>
                  </form>

                  {error && (
                    <Alert className="mt-4 border-red-200 bg-red-50">
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Summary */}
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h2 className="text-xl font-bold text-gray-900">AI Summary</h2>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          Enhanced
                        </Badge>
                      </div>
                      {shouldShowExpandButton(summary) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSummaryExpanded(!summaryExpanded)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                        >
                          {summaryExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-1" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-1" />
                              Show More
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    <div className={`overflow-hidden transition-all duration-300 ${
                      summaryExpanded ? 'max-h-none' : 'max-h-96'
                    }`}>
                      <div className="text-gray-700 leading-relaxed prose prose-gray max-w-none prose-sm">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children }) => (
                              <h2 className="text-base font-semibold text-gray-900 mt-3 mb-2 first:mt-0">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-medium text-gray-800 mt-2 mb-1">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="mb-2 text-gray-700 leading-relaxed text-sm">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-2 space-y-0.5 list-disc list-inside text-gray-700 text-sm pl-2">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-2 space-y-0.5 list-decimal list-inside text-gray-700 text-sm pl-2">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="leading-relaxed text-sm">
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
                              <blockquote className="border-l-4 border-purple-200 pl-3 italic text-gray-600 my-2 text-sm">
                                {children}
                              </blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="min-w-full text-xs border border-gray-200 rounded">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium text-gray-900 text-xs">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-gray-200 px-2 py-1 text-gray-700 text-xs">
                                {children}
                              </td>
                            ),
                            hr: () => (
                              <hr className="border-gray-300 my-2" />
                            )
                          }}
                        >
                          {summaryExpanded ? summary : truncateSummary(summary)}
                        </ReactMarkdown>
                      </div>
                    </div>
                    
                    {!summaryExpanded && shouldShowExpandButton(summary) && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-purple-50 to-transparent pointer-events-none" />
                    )}
                    
                    {summary.length > 100 && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <div className="flex items-center justify-between text-xs text-purple-600">
                          <span>{summary.split(' ').length} words • AI-generated summary</span>
                          <span className="bg-purple-100 px-2 py-1 rounded">
                            ✨ Enhanced with GPT
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {/* Results Header */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {results.length} Result{results.length !== 1 ? 's' : ''}
                    </h2>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      {query}
                    </Badge>
                  </div>

                  {/* Sort Controls */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "relevance" | "date")}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                      className="flex items-center gap-1"
                    >
                      {sortOrder === "desc" ? (
                        <SortDesc className="w-4 h-4" />
                      ) : (
                        <SortAsc className="w-4 h-4" />
                      )}
                      {sortOrder === "desc" ? "Desc" : "Asc"}
                    </Button>
                  </div>
                </div>

                {/* Results List */}
                <div className="space-y-4">
                  {sortedResults.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getDomainColor(result.domain)}>
                                  {result.domain}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  Score: {result.score.toFixed(2)}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-purple-600 transition-colors">
                                <a href={result.url} target="_blank" rel="noopener noreferrer">
                                  {result.title}
                                </a>
                              </h3>
                              <p className="text-gray-600 mb-3 leading-relaxed">
                                {formatText(result.content)}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>{result.url}</span>
                                <span>•</span>
                                <span>{new Date(result.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(result.url, '_blank')}
                                  className="ml-4"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Open in new tab</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && query && !error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or check if content has been crawled.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
} 