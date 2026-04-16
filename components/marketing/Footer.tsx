"use client";

import Link from "next/link";
import { Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative bg-white border-t border-gray-100 pt-16 pb-48">
      <div className="container max-w-5xl mx-auto px-4 relative z-10">
        {/* Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-32">
          {/* Product */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">AI Agents</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Integrations</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><Link href="#" className="hover:text-blue-600 transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">Resources</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Documentation</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">API Reference</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Tutorials</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Help Center</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Terms</Link></li>
              <li><Link href="#" className="hover:text-blue-600 transition-colors">Security</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div className="text-center">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">Social</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">LinkedIn</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright
        <div className="pt-8 border-t border-gray-200 text-center text-xs text-gray-500 relative z-20">
          © 2026 INVENTO.AI. All rights reserved. Made with ❤️ by <a href="https://02-Shubham.vercel.app">Shubham</a>
        </div> */}
      </div>

      {/* Large Brand Watermark - Positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 w-full pointer-events-none select-none z-0">
        <div className="w-full flex items-center justify-center">
          <h2 
            className="font-bold leading-none whitespace-nowrap"
            style={{
              fontSize: 'clamp(8rem, 20vw, 18rem)',
              color: 'rgba(0, 0, 0, 0.055)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.03em'
            }}
          >
            INVENTO.AI
          </h2>
        </div>
      </div>

      
    </footer>
  );
}
