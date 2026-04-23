import React from 'react';
import { Box, Typography } from '@mui/material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ResponsivaProps {
  adminName: string;
  choferName: string;
  cardData: {
    codigo: string;
    cuenta: string;
    tarjeta: string;
  };
}

export const ResponsivaDocument: React.FC<ResponsivaProps> = ({ adminName, choferName, cardData }) => {
  const today = format(new Date(), "d 'DE' MMMM 'DE' yyyy", { locale: es }).toUpperCase();

  return (
    <Box id="responsiva-printable" sx={{ 
      p: 2, 
      bgcolor: 'white', 
      color: 'black', 
      fontFamily: 'Arial, sans-serif', 
      width: '100%',
      maxWidth: '800px',
      margin: 'auto',
      "@media print": {
        p: 0,
        margin: 0,
        width: '100%',
        "-webkit-print-color-adjust": "exact"
      }
    }}>
      {/* HEADER PROFESIONAL */}
      <table style={{ width: '100%', borderBottom: '2px solid #1a237e', marginBottom: '15px' }}>
        <tbody>
          <tr>
            <td style={{ width: '200px', paddingBottom: '10px' }}>
              <img 
                src="/logo_empresa.png" 
                alt="Logo" 
                width="180"
                style={{ width: '180px', height: 'auto', display: 'block' }} 
              />
            </td>
            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              <Typography sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '1rem', lineHeight: 1.2 }}>
                ENTREGA, USO Y RESPONSIVA DE<br/>TARJETA DE COMBUSTIBLE
              </Typography>
            </td>
          </tr>
        </tbody>
      </table>

      <Typography sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', mb: 2 }}>
        SATÉLITE, NAUCALPAN, ESTADO DE MÉXICO, A {today}
      </Typography>

      <Box sx={{ mb: 2, fontSize: '0.9rem' }}>
        <Typography sx={{ fontWeight: 'bold' }}>ASUNTO: </Typography>
        <Typography sx={{ fontWeight: 'bold', mt: 1 }}>A QUIEN CORRESPONDA:</Typography>
      </Box>

      <Typography sx={{ textAlign: 'justify', mb: 2, fontSize: '0.9rem' }}>
        Por medio de la presente, se hace constar la <strong>entrega de la tarjeta de combustible “Efectivale”</strong>, bajo las siguientes especificaciones:
      </Typography>

      {/* ESPECIFICACIONES */}
      <Box sx={{ ml: 4, mb: 2 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>
            <tr><td style={{ padding: '3px 0' }}><strong>• Código:</strong></td><td style={{ paddingLeft: '15px' }}>{cardData.codigo || '[●]'}</td></tr>
            <tr><td style={{ padding: '3px 0' }}><strong>• Número de cuenta:</strong></td><td style={{ paddingLeft: '15px' }}>{cardData.cuenta || '[●]'}</td></tr>
            <tr><td style={{ padding: '3px 0' }}><strong>• Número de tarjeta:</strong></td><td style={{ paddingLeft: '15px' }}>{cardData.tarjeta || '[●]'}</td></tr>
          </tbody>
        </table>
      </Box>

      <Typography sx={{ textAlign: 'justify', mb: 3, fontSize: '0.9rem' }}>
        La tarjeta es propiedad de la empresa y se asigna al colaborador exclusivamente para el desempeño de sus funciones laborales.
      </Typography>

      {/* CLÁUSULAS COMPLETAS */}
      <Box sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
        <Typography sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.9rem' }}>CLÁUSULAS Y CONDICIONES</Typography>
        
        <Typography sx={{ fontWeight: 'bold' }}>PRIMERA. USO AUTORIZADO</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1.5 }}>
          El uso de la tarjeta queda estrictamente limitado a la carga de combustible para vehículos asignados o autorizados por la empresa. Queda prohibido su uso para fines personales o distintos a los aquí establecidos.
        </Typography>

        <Typography sx={{ fontWeight: 'bold' }}>SEGUNDA. RESPONSABILIDAD SOBRE EL USO</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1.5 }}>
          El colaborador será responsable directo del uso de la tarjeta desde el momento de su recepción y hasta su devolución formal. Cualquier cargo no reconocido o indebido será imputable al usuario salvo prueba en contrario.
        </Typography>

        <Typography sx={{ fontWeight: 'bold' }}>TERCERA. EXTRAVÍO, ROBO O USO INDEBIDO</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1.5 }}>
          En caso de extravío, robo o uso indebido, el colaborador deberá reportarlo de inmediato. En caso de omisión o retraso en el aviso, será responsable de los cargos generados hasta el momento del bloqueo.
        </Typography>

        <Typography sx={{ fontWeight: 'bold' }}>CUARTA. COSTOS DE REPOSICIÓN Y ENVÍO</Typography>
        <Box sx={{ ml: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>• Reposición: $150.00 MXN + IVA ($174.00 MXN)</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Envío: $150.00 MXN + IVA ($174.00 MXN)</Typography>
        </Box>

        <Typography sx={{ fontWeight: 'bold', mt: 2, mb: 1, fontSize: '0.9rem' }}>CLÁUSULAS DE CONTROL Y CUMPLIMIENTO</Typography>

        <Typography sx={{ fontWeight: 'bold' }}>QUINTA. DESCUENTO VÍA NÓMINA</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1 }}>
          El colaborador autoriza expresamente a la empresa a realizar descuentos vía nómina por los siguientes conceptos:
        </Typography>
        <Box sx={{ ml: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>• Cargos por uso indebido de la tarjeta</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Consumos no comprobables o no autorizados</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Costos de reposición o daños</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Diferencias derivadas de auditorías</Typography>
          <Typography sx={{ fontSize: 'inherit', mt: 0.5 }}>Lo anterior, en apego a la legislación laboral vigente y previa notificación al colaborador.</Typography>
        </Box>

        <Typography sx={{ fontWeight: 'bold' }}>SEXTA. AUDITORÍA DE CONSUMOS</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1 }}>
          La empresa se reserva el derecho de realizar auditorías periódicas o extraordinarias sobre el uso de la tarjeta, incluyendo:
        </Typography>
        <Box sx={{ ml: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>• Validación de montos vs. rutas asignadas</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Frecuencia de cargas</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Consumo promedio por vehículo</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Comparación contra indicadores operativos</Typography>
        </Box>

        <Typography sx={{ fontWeight: 'bold' }}>SÉPTIMA. GEOLOCALIZACIÓN Y TRAZABILIDAD</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1 }}>
          El colaborador acepta que la empresa podrá:
        </Typography>
        <Box sx={{ ml: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>• Cruzar información de consumo con datos de geolocalización del vehículo</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Validar ubicación de cargas contra rutas de trabajo</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Utilizar sistemas GPS o telemetría para verificación</Typography>
          <Typography sx={{ fontSize: 'inherit', mt: 0.5 }}>Cualquier carga realizada fuera de zonas o rutas autorizadas podrá considerarse uso indebido.</Typography>
        </Box>

        <Typography sx={{ fontWeight: 'bold' }}>OCTAVA. COMPROBACIÓN DE CONSUMO</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1 }}>
          El colaborador deberá, cuando sea requerido:
        </Typography>
        <Box sx={{ ml: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>• Presentar tickets o comprobantes de carga</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Justificar consumos atípicos</Typography>
          <Typography sx={{ fontSize: 'inherit' }}>• Validar que el combustible corresponde al vehículo asignado</Typography>
          <Typography sx={{ fontSize: 'inherit', mt: 0.5 }}>La falta de comprobación podrá derivar en responsabilidad económica.</Typography>
        </Box>

        <Typography sx={{ fontWeight: 'bold' }}>NOVENA. USO PERSONAL Y SANCIONES</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 1.5 }}>
          El uso de la tarjeta para fines personales se considerará una falta grave, pudiendo derivar en: descuentos vía nómina, medidas disciplinarias internas o terminación de la relación laboral conforme a la normatividad aplicable.
        </Typography>

        <Typography sx={{ fontWeight: 'bold' }}>DÉCIMA. DEVOLUCIÓN</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 3 }}>
          El colaborador se obliga a devolver la tarjeta en caso de: terminación laboral, cambio de funciones o solicitud expresa de la empresa.
        </Typography>

        <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem', mb: 1, textAlign: 'center' }}>DECLARACIÓN DE CONFORMIDAD</Typography>
        <Typography sx={{ textAlign: 'justify', mb: 5, fontSize: '0.85rem' }}>
          El colaborador manifiesta haber recibido la tarjeta en condiciones adecuadas, así como entender y aceptar la totalidad de las cláusulas del presente documento, obligándose a su cumplimiento.
        </Typography>
      </Box>

      {/* SECCIÓN DE FIRMAS */}
      <table style={{ width: '100%', marginTop: '30px' }}>
        <tbody>
          <tr>
            <td style={{ width: '45%', textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem', mb: 4 }}>ENTREGA</Typography>
              <Box sx={{ borderTop: '1px solid black', pt: 1, width: '250px' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Nombre: {adminName.toUpperCase()}</Typography>
                <Typography sx={{ fontSize: '0.75rem' }}>Firma:</Typography>
              </Box>
            </td>
            <td style={{ width: '10%' }}></td>
            <td style={{ width: '45%', textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem', mb: 4 }}>RECIBE</Typography>
              <Box sx={{ borderTop: '1px solid black', pt: 1, width: '250px' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Nombre: {choferName.toUpperCase()}</Typography>
                <Typography sx={{ fontSize: '0.75rem' }}>Firma:</Typography>
              </Box>
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
};
