"use client"

import { NextRequest, NextResponse } from "next/server";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { KidsTopbar } from "@/components/kids/KidsTopbar";
import { Paperclip, ImageIcon, Send, Loader2, Sparkles, User, Bot } from "lucide-react";
import { getClasses, getAssignments, getGrades, getStudentGrades, getMeetings } from "@/lib/api";
import { useRole } from "@/context/RoleContext";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useRef } from "react";
import { useI18n } from "@/components/translate/client";

export default function AIGradesHelperPage() {
  //mini logika untuk t
  const t = useI18n();
  const { isKidsMode } = useRole();

  //State untuk mengirim pesan ke AI
  const [sendMessage, setSendMessage] = useState("");

  //State untuk menyimpan riwayat chat
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  //State untuk menunggu loading respon dari AI
  const [waitResponseAI, setwaitResponseAI] = useState(false);

  //State untuk mengaktifkan AIGradesHelper
  const [TurnOnAI, setTurnOnAI] = useState(false);

  //State untuk mengakhiri chat
  const [endChat, setendChat] = useState(false);

  //sedikit logika dari endchat
  const endChatRef = useRef<HTMLDivElement>(null);

  //Mengkoneksikan dengan Backend AIGradesHelper
  async function ConnectBackend(req: NextRequest) {
    try {
      //mencoba fetch dengan API
      const FetchAPI = await fetch('/api/ScorpioAI', {
        //Fetch API menggunakan method POST (alias mengambil data)
        method: 'POST',

        // Mengirimkan data ke Backend (Konfigurasi headers)
        headers: {
          'Content-Type': 'application/json',
        },
        // Mengirimkan data ke Backend (Konfigurasi body)
        body: JSON.stringify({
          role: 'teacher',
          classLevel: '1',
          contextData: 'contextData',
          history: 'history',
        })
      })

      //Hasil respon (menunggu response dari backend(Fetch API))
      const Response = await FetchAPI.json();
    } catch (error) {
      console.log("Error to connect with AI")
    }
  }

  //Logika untuk kirim pesan ke AI
  function SendMessageToAI(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!sendMessage.trim() || waitResponseAI) return;

    // Tambahkan pesan user ke riwayat chat
    setMessages(prev => [...prev, { role: "user", content: sendMessage.trim() }]);

    // Kosongkan input
    setSendMessage("");

    // Koneksikan backend & tunggu respon AI
    setwaitResponseAI(true);

    // TODO: panggil ConnectBackend dan tambahkan respon AI ke messages
    // const connectbackend = ConnectBackend;
  }
  // ============================================
  // Custom ReactMarkdown Components — Tabel & Elemen Markdown Premium
  // ============================================
  // Komponen custom untuk Kids Mode — warna orange, playful dan fun
  const kidsMarkdownComponents = {
    table: ({ children, ...props }: any) => (
      <div className="my-4 w-full overflow-x-auto rounded-2xl border-2 border-orange-200 shadow-md shadow-orange-100">
        <table className="w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-gradient-to-r from-orange-100 to-yellow-50 border-b-2 border-orange-200" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-3 text-left text-xs font-black text-orange-700 uppercase tracking-wider first:rounded-tl-2xl last:rounded-tr-2xl" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-3 text-sm text-slate-700 font-medium border-t border-orange-100" {...props}>
        {children}
      </td>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="transition-colors even:bg-orange-50/50 hover:bg-orange-50/80" {...props}>
        {children}
      </tr>
    ),
  };

  // Komponen custom untuk Default Mode — tema biru, profesional
  const defaultMarkdownComponents = {
    table: ({ children, ...props }: any) => (
      <div className="my-4 w-full overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
        <table className="w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/30 border-b border-slate-200 dark:border-slate-700" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-3 text-left text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider first:rounded-tl-2xl last:rounded-tr-2xl" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/60" {...props}>
        {children}
      </td>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="transition-colors even:bg-blue-50/30 dark:even:bg-blue-900/10 hover:bg-blue-50/60 dark:hover:bg-blue-900/20" {...props}>
        {children}
      </tr>
    ),
  };

  if (isKidsMode) {
    return (
      <div className="flex flex-col h-full min-h-0 relative font-sans overflow-hidden" 
         style={{ background: "#FFF5E1" }}>
      
      <KidsTopbar />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 z-10 scroll-smooth hide-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 animate-in fade-in duration-700">
              <div className="text-8xl animate-bounce">🤖</div>
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] shadow-xl border-4 border-orange-200 max-w-lg">
                <h3 className="text-2xl font-black text-orange-600 mb-2">{t("kids.scorpio.title")}</h3>
                <p className="text-slate-600 font-medium">
                  {t("kids.scorpio.desc")}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-500`}>
              <div className={`flex gap-3 sm:gap-4 max-w-[90%] sm:max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 mt-auto text-2xl sm:text-3xl border-2 shadow-md ${
                  msg.role === "user" 
                    ? "bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300" 
                    : "bg-gradient-to-br from-orange-100 to-yellow-100 border-orange-300 shadow-orange-500/20"
                }`}>
                  {msg.role === "user" ? "🧑‍🎓" : "🤖"}
                </div>
                
                <div className={`px-5 py-4 text-[15px] sm:text-base leading-relaxed transition-all shadow-md ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-[28px] rounded-br-md border-2 border-blue-400/50 shadow-blue-500/20 whitespace-pre-wrap font-medium"
                    : "bg-white/95 backdrop-blur-xl text-slate-800 border-2 border-orange-200/80 rounded-[28px] rounded-bl-md shadow-orange-500/10"
                }`}>
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <div className="prose prose-sm sm:prose-base max-w-none
                      prose-p:leading-relaxed prose-p:font-medium prose-p:my-2
                      prose-headings:text-orange-600 prose-headings:font-black prose-headings:tracking-tight
                      prose-h1:text-xl prose-h1:border-b-2 prose-h1:border-orange-200 prose-h1:pb-2 prose-h1:mb-3
                      prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2
                      prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5
                      prose-strong:text-orange-600 prose-strong:font-black
                      prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-a:font-bold
                      prose-ul:list-disc prose-ul:my-2 prose-ol:list-decimal prose-ol:my-2
                      prose-li:my-0.5 prose-li:marker:text-orange-400
                      prose-blockquote:border-l-4 prose-blockquote:border-orange-400 prose-blockquote:bg-orange-50/60 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:my-3
                      prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-2xl prose-pre:shadow-inner prose-pre:my-3
                      prose-hr:border-orange-200 prose-hr:my-4
                      prose-img:rounded-2xl prose-img:shadow-md prose-img:border-2 prose-img:border-orange-200">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={kidsMarkdownComponents}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {waitResponseAI && (
            <div className="flex justify-start">
              <div className="flex gap-4 items-end">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-sm">
                  🤖
                </div>
                <div className="bg-white px-5 py-4 rounded-[28px] rounded-bl-md border-2 border-orange-200 shadow-sm flex items-center gap-2 h-14">
                  <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span>
                  <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span>
                  <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={endChatRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 lg:p-6 bg-transparent z-20 pb-6 lg:pb-8">
        <form onSubmit={(e) => SendMessageToAI(e)} className="max-w-4xl mx-auto">
          <div className="flex items-end bg-white rounded-[32px] shadow-lg border-4 border-orange-200 p-2 sm:p-3 focus-within:ring-4 focus-within:ring-orange-200 focus-within:border-orange-400 transition-all">

            <textarea 
              value={sendMessage} 
              onChange={(e) => setSendMessage(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  SendMessageToAI();
                }
              }}
              placeholder={t("kids.scorpio.placeholder")}
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-slate-800 placeholder-slate-400 text-base sm:text-lg font-medium resize-none py-3 sm:py-4 px-4 max-h-32 hide-scrollbar" 
              rows={1}
            />
            
            <button 
              type="submit" 
              disabled={!sendMessage.trim() || waitResponseAI}
              className="m-1 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 disabled:from-slate-200 disabled:to-slate-300 text-white transition-all shadow-md active:scale-95 disabled:scale-100 disabled:shadow-none"
            >
              {waitResponseAI ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6 ml-1" />}
            </button>
          </div>
          <p className="text-xs text-center text-orange-600/60 mt-3 font-bold">
            {t("kids.scorpio.disclaimer")}
          </p>
        </form>
      </div>
    </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50 dark:bg-[#003049] relative font-sans overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <Topbar />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 z-10 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 opacity-80 mt-10">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 shadow-inner"><Sparkles className="w-10 h-10" /></div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t("kids.scorpio.title")}</h3>
                <p className="text-slate-500 mt-2 max-w-sm">{t("kids.scorpio.desc")}</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-3 duration-500`}>
              <div className={`flex gap-3 max-w-[90%] md:max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 mt-auto shadow-sm ${msg.role === "user" ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300" : "bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                  }`}>
                  {msg.role === "user" ? <User className="w-4 h-4 md:w-5 md:h-5" /> : <Bot className="w-4 h-4 md:w-5 md:h-5" />}
                </div>
                <div className={`px-5 py-4 text-[15px] leading-relaxed transition-all ${msg.role === "user"
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-[24px] rounded-br-sm shadow-md shadow-blue-500/20 whitespace-pre-wrap"
                  : "bg-white/95 dark:bg-[#003049]/95 backdrop-blur-xl text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-[24px] rounded-bl-sm shadow-lg shadow-slate-200/40 dark:shadow-none"
                  }`}>
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none
                      prose-p:leading-relaxed prose-p:my-2
                      prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-headings:font-bold prose-headings:tracking-tight
                      prose-h1:text-xl prose-h1:border-b prose-h1:border-slate-200 dark:prose-h1:border-slate-700 prose-h1:pb-2 prose-h1:mb-3
                      prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2
                      prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5
                      prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-bold
                      prose-a:text-blue-600 hover:prose-a:text-blue-500 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                      prose-ul:list-disc prose-ul:my-2 prose-ol:list-decimal prose-ol:my-2
                      prose-li:my-0.5 prose-li:marker:text-blue-500 dark:prose-li:marker:text-blue-400
                      prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300 prose-blockquote:my-3
                      prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-blue-50/80 dark:prose-code:bg-blue-900/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-semibold prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:border prose-pre:border-slate-800 prose-pre:shadow-xl prose-pre:rounded-xl prose-pre:my-3
                      prose-hr:border-slate-200 dark:prose-hr:border-slate-700 prose-hr:my-4
                      prose-img:rounded-xl prose-img:shadow-md">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={defaultMarkdownComponents}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {waitResponseAI && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0"><Bot className="w-4 h-4" /></div>
                <div className="bg-white dark:bg-[#003049] px-5 py-4 rounded-[24px] rounded-bl-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={endChatRef} className="h-4" />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 lg:p-6 bg-transparent z-20 pb-8 lg:pb-10">
        <form onSubmit={(e) => SendMessageToAI(e)} className="max-w-4xl mx-auto relative group">
          <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl blur-xl transition-all group-focus-within:bg-blue-500/20"></div>
          <div className="relative flex items-end bg-white/80 dark:bg-[#003049]/80 backdrop-blur-xl rounded-[24px] shadow-lg shadow-slate-200/50 dark:shadow-black/50 border border-slate-200 dark:border-slate-800 p-2 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">

            <button type="button" className="p-3 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 mb-0.5">
              <Paperclip className="w-5 h-5" />
            </button>
            <button type="button" className="p-3 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 mb-0.5">
              <ImageIcon className="w-5 h-5" />
            </button>

            <textarea
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  SendMessageToAI();
                }
              }}
              placeholder={t("scorpio.studentPlaceholder")}
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-[15px] resize-none py-3.5 px-2 max-h-32 hide-scrollbar"
              rows={1}
            />

            <button type="submit" disabled={!sendMessage.trim() || waitResponseAI}
              className="m-1.5 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 transition-all shadow-md hover:shadow-blue-500/30 active:scale-95 disabled:shadow-none mb-0.5">
              {waitResponseAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
            </button>
          </div>
          <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-3 font-medium">{t("scorpio.disclaimer")}</p>
        </form>
      </div>
    </div>
  )
}

