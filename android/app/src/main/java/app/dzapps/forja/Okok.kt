package app.dzapps.forja

import android.util.SparseArray

/** Balanças OKOK/Chipsea: o peso vem no próprio anúncio Bluetooth (sem conectar).
 *  Formatos conhecidos pelo "manufacturer id" do anúncio:
 *  0x20CA (V20: flag de final + checksum XOR, traz impedância), 0x11CA (V11: checksum XOR),
 *  0xF0FF (VF0: só peso) e ids terminados em 0xC0 (flag de estável, traz impedância). */
object Okok {
    data class Leitura(val kg: Double, val impedancia: Double, val final: Boolean, val modelo: String)

    private fun u16(hi: Byte, lo: Byte) = ((hi.toInt() and 0xFF) shl 8) or (lo.toInt() and 0xFF)
    private fun divisor(bits: Int) = when (bits) { 1 -> 1.0; 2 -> 100.0; else -> 10.0 }
    private fun paraKg(bruto: Int, div: Double, unidade: Int, hi: Byte, lo: Byte): Double? = when (unidade) {
        0 -> bruto / div                        // kg
        1 -> bruto / div / 2.0                  // jin
        2 -> bruto / div / 2.204623             // libras
        3 -> (hi.toInt() and 0xFF) * 6.350293 + ((lo.toInt() and 0xFF) / div) * 0.453592 // st:lb
        else -> null
    }

    fun ler(m: SparseArray<ByteArray>, nome: String?): Leitura? {
        m.get(0x20CA)?.let { d ->
            if (d.size != 19) return null
            val flags = d[6].toInt() and 0xFF
            val div = if (flags and 0x04 != 0) 100.0 else 10.0
            val kg = u16(d[8], d[9]) / div
            var x = 0x20
            for (i in 0 until 12) x = x xor (d[i].toInt() and 0xFF)
            val final = (flags and 0x01) != 0 && (d[12].toInt() and 0xFF) == (x and 0xFF)
            return Leitura(kg, u16(d[10], d[11]) / 10.0, final, "OKOK V20")
        }
        m.get(0x11CA)?.let { d ->
            if (d.size != 23) return null
            var x = 0xCA xor 0x11
            for (i in 0 until 16) x = x xor (d[i].toInt() and 0xFF)
            if ((d[16].toInt() and 0xFF) != (x and 0xFF)) return null
            val p = d[9].toInt() and 0xFF
            val kg = paraKg(u16(d[3], d[4]), divisor((p shr 1) and 3), (p shr 3) and 3, d[3], d[4]) ?: return null
            return Leitura(kg, 0.0, true, "OKOK V11")
        }
        m.get(0xF0FF)?.let { d ->
            if (d.size < 4) return null
            return Leitura(u16(d[3], d[2]) / 10.0, 0.0, true, "OKOK VF0")
        }
        // ids terminados em 0xC0: só para nomes de balança conhecidos (evita confundir com outro aparelho)
        val n = nome ?: ""
        val nomeOk = n.isEmpty() || n == "ADV" || n == "Chipsea-BLE" || n.startsWith("Yoda", true)
        if (!nomeOk) return null
        for (i in 0 until m.size()) {
            if ((m.keyAt(i) and 0xFF) != 0xC0) continue
            val d = m.valueAt(i) ?: continue
            if (d.size < 13) continue
            val a = d[6].toInt() and 0xFF
            val kg = paraKg(u16(d[0], d[1]), divisor((a shr 1) and 3), (a shr 3) and 3, d[0], d[1]) ?: continue
            return Leitura(kg, u16(d[2], d[3]) / 10.0, (a and 0x01) != 0, "OKOK C0")
        }
        return null
    }
}
