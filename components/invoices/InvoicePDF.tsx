import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { Invoice } from '@/types';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  companyInfo: {
    textAlign: 'right',
  },
  invoiceInfo: {
    marginBottom: 20,
  },
  label: {
    color: '#666',
    fontSize: 10,
    marginBottom: 2,
  },
  value: {
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  table: {
    width: '100%',
    borderStyle: 'solid', 
    borderWidth: 1, 
    borderColor: '#eee',
    marginBottom: 20,
  },
  tableRow: { 
    margin: 'auto', 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    padding: 8,
  }, 
  tableHeader: {
    backgroundColor: '#f9f9f9',
    fontWeight: 'bold',
  },
  colProduct: {
    width: '50%',
  },
  colQty: {
    width: '15%',
    textAlign: 'center',
  },
  colPrice: {
    width: '15%',
    textAlign: 'right',
  },
  colTotal: {
    width: '20%',
    textAlign: 'right',
  },
  totals: {
    alignItems: 'flex-end',
    marginTop: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '40%',
    marginBottom: 5,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 5,
    marginTop: 5,
  }
});

interface InvoicePDFProps {
  invoice: Invoice;
  settings: any; // Using any for simplicity here to avoid re-declaring Settings interface type or importing it, but strictly it should be Settings
}

export const InvoicePDF = ({ invoice, settings }: InvoicePDFProps) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", { 
            style: "currency", 
            currency: settings?.currency || "USD" 
        }).format(amount);
    }
  
    const invoiceItems = Array.isArray(invoice.items) 
        ? invoice.items 
        : Object.values(invoice.items || {});

    return (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.value}>#{invoice.invoiceNumber}</Text>
          <Text style={styles.label}>Status: {(invoice.status || 'pending').toUpperCase()}</Text>
        </View>
        <View style={styles.companyInfo}>
          <Text style={{ fontWeight: 'bold' }}>{settings?.businessName || "Shubham Bags"}</Text>
          <Text>{settings?.businessAddress || "Powai, Mumbai"}</Text>
          <Text>{settings?.businessEmail || "shubham@shubhambags.com"}</Text>
          <Text>{settings?.businessPhone || "8850502975"}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
        {/* Bill To */}
        <View style={styles.section}>
            <Text style={{ ...styles.label, fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>Bill To:</Text>
            <Text>{invoice.customerName}</Text>
            <Text>{invoice.customerEmail}</Text>
            {invoice.customerPhone && <Text>{invoice.customerPhone}</Text>}
            {invoice.customerAddress && <Text>{invoice.customerAddress}</Text>}
        </View>

        {/* Invoice Dates */}
        <View style={styles.section}>
            <Text style={styles.label}>Date issued:</Text>
            <Text style={styles.value}>
                {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'PPP') : 'N/A'}
            </Text>
            
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>
                {invoice.dueDate ? format(new Date(invoice.dueDate), 'PPP') : 'N/A'}
            </Text>
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.colProduct}>Product</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {invoiceItems.map((item: any, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colProduct}>{item.productName}</Text>
            <Text style={styles.colQty}>{String(item.quantity)}</Text>
            <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(item.total)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text>Subtotal:</Text>
          <Text>{formatCurrency(invoice.subtotal)}</Text>
        </View>
        {/* Tax removed */}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text>{formatCurrency(invoice.total)}</Text>
        </View>
      </View>

      {/* Footer / Notes */}
      {invoice.notes && (
          <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }}>
              <Text style={styles.label}>Notes:</Text>
              <Text>{invoice.notes}</Text>
          </View>
      )}

    </Page>
  </Document>
)};
