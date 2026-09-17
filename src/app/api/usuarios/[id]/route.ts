import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth/guarda";
import { revogarSessoesDoUsuario } from "@/lib/auth/sessao";

const alteracao = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().transform(v => v.toLowerCase()).optional(),
  papel: z.enum(["ADMIN", "OPERADOR", "LEITURA"]).optional(),
  ativo: z.boolean().optional(),
});
async function outrosAdminsAtivos(id: string) { return prisma.usuario.count({ where:{ papel:"ADMIN", ativo:true, NOT:{id} } }); }

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guarda = await exigirAdmin(); if (guarda.erro) return guarda.erro;
  const { id } = await ctx.params;
  const dados = alteracao.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({erro:mensagemDeValidacao(dados.error)},{status:400});
  if (!Object.keys(dados.data).length) return NextResponse.json({erro:"Nada para alterar."},{status:400});
  const alvo = await prisma.usuario.findUnique({where:{id}}); if(!alvo) return NextResponse.json({erro:"Usuário não encontrado."},{status:404});
  const self = id === guarda.sessao.sub;
  if(self && dados.data.ativo===false) return NextResponse.json({erro:"Você não pode inativar a própria conta."},{status:400});
  if(self && dados.data.papel && dados.data.papel!=="ADMIN") return NextResponse.json({erro:"Você não pode rebaixar o próprio perfil."},{status:400});
  const perdeAdmin=alvo.papel==="ADMIN"&&alvo.ativo&&(dados.data.ativo===false||(dados.data.papel&&dados.data.papel!=="ADMIN"));
  if(perdeAdmin && await outrosAdminsAtivos(id)===0) return NextResponse.json({erro:"Este é o último administrador ativo. Promova outra pessoa antes."},{status:400});
  if(dados.data.email && dados.data.email!==alvo.email){ const existe=await prisma.usuario.findUnique({where:{email:dados.data.email}}); if(existe&&existe.id!==id) return NextResponse.json({erro:"Já existe um usuário com este e-mail."},{status:409}); }
  const atualizado=await prisma.usuario.update({where:{id},data:dados.data,select:{id:true,nome:true,email:true,papel:true,ativo:true,trocarSenha:true,ultimoAcesso:true,convidadoEm:true}});
  if(dados.data.ativo===false || (dados.data.email && dados.data.email!==alvo.email)) await revogarSessoesDoUsuario(id);
  await prisma.registroAcesso.create({data:{email:atualizado.email,acao:"alteracao-conta",sucesso:true,detalhe:`Conta editada por ${guarda.sessao.email}`}});
  await registrarAuditoria({
    sessao: guarda.sessao, modulo: "Usuários", acao: dados.data.ativo === false ? "inativar" : dados.data.ativo === true ? "ativar" : "editar", registroId: atualizado.id,
    descricao: `Conta de ${atualizado.nome} alterada.`,
    antes: { id: alvo.id, nome: alvo.nome, email: alvo.email, papel: alvo.papel, ativo: alvo.ativo, trocarSenha: alvo.trocarSenha },
    depois: { id: atualizado.id, nome: atualizado.nome, email: atualizado.email, papel: atualizado.papel, ativo: atualizado.ativo, trocarSenha: atualizado.trocarSenha },
  });
  return NextResponse.json({ok:true,usuario:atualizado});
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guarda=await exigirAdmin(); if(guarda.erro) return guarda.erro;
  const {id}=await ctx.params;
  if(id===guarda.sessao.sub) return NextResponse.json({erro:"Você não pode excluir a própria conta."},{status:400});
  const alvo=await prisma.usuario.findUnique({where:{id}}); if(!alvo) return NextResponse.json({erro:"Usuário não encontrado."},{status:404});
  if(alvo.papel==="ADMIN"&&alvo.ativo&&await outrosAdminsAtivos(id)===0) return NextResponse.json({erro:"Este é o último administrador ativo. Promova outra pessoa antes."},{status:400});
  await prisma.$transaction(async tx=>{ await tx.usuario.delete({where:{id}}); await tx.registroAcesso.create({data:{email:alvo.email,acao:"exclusao-conta",sucesso:true,detalhe:`Conta excluída por ${guarda.sessao.email}`}}); });
  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Usuários", acao: "excluir", registroId: alvo.id, descricao: `Conta de ${alvo.nome} excluída.`, antes: { id: alvo.id, nome: alvo.nome, email: alvo.email, papel: alvo.papel, ativo: alvo.ativo, trocarSenha: alvo.trocarSenha } });
  return NextResponse.json({ok:true});
}
