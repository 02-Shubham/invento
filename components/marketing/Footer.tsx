import Link from "next/link";
import { Archive, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Archive className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Invo</span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Simplifying inventory management for modern businesses worldwide.
            </p>
            <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-gray-900"><Twitter className="h-5 w-5" /></a>
                <a href="#" className="text-gray-400 hover:text-gray-900"><Github className="h-5 w-5" /></a>
                <a href="#" className="text-gray-400 hover:text-gray-900"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">Features</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Pricing</Link></li>
                <li><Link href="#" className="hover:text-blue-600">API</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Integrations</Link></li>
            </ul>
          </div>

          <div>
             <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">About</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Blog</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Careers</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-blue-600">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Invo Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
